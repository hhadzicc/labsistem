using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LABsistem.Application.Models;
using LABsistem.Application.Services;
using LABsistem.Application.Validators;
using LABsistem.Dal.Db;
using LABsistem.Dal.Interfaces;
using LABsistem.Dal.Repositories;
using LABsistem.Api.Services;
using LABsistem.Api.Options;
using LABsistem.Application.DTOs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using LABsistem.Api.Validators;
using LABsistem.Presentation.BackgroundServices;
using LABsistem.Presentation.Configuration;
using LABsistem.Presentation.Services;
using Microsoft.AspNetCore.Authorization;

var builder = WebApplication.CreateBuilder(args);
LoadDotEnvFile(Path.Combine(builder.Environment.ContentRootPath, ".env"));
LoadDotEnvFile(Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".env")));
builder.Configuration.AddEnvironmentVariables();

var connectionString = builder.Configuration.GetConnectionString("Default");
if (!builder.Environment.IsEnvironment("Testing") && string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("ConnectionStrings:Default nije konfigurisan.");
}

if (!string.IsNullOrWhiteSpace(connectionString))
{
    connectionString = DatabaseConnectionString.Normalize(connectionString);
}

var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
    ?? throw new InvalidOperationException("JWT konfiguracija nije pronadjena.");

if (string.IsNullOrWhiteSpace(jwtSettings.Key) || jwtSettings.Key.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key mora biti konfigurisan i imati najmanje 32 karaktera.");
}

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

var frontendBaseUrl = builder.Configuration["FRONTEND_BASE_URL"]
    ?? builder.Configuration["FrontendBaseUrl"];

if (!string.IsNullOrWhiteSpace(frontendBaseUrl))
{
    allowedOrigins = [.. allowedOrigins, frontendBaseUrl];
}

allowedOrigins = allowedOrigins
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(NormalizeOrigin)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

if (allowedOrigins.Length == 0)
{
    throw new InvalidOperationException("Najmanje jedan CORS frontend origin mora biti konfigurisan.");
}

if (!builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddDbContext<LabSistemDbContext>(options =>
        options.UseNpgsql(connectionString));
}

builder.Services.AddMemoryCache();
builder.Services.Configure<ReservationReminderOptions>(
    builder.Configuration.GetSection(ReservationReminderOptions.SectionName));
builder.Services
    .AddOptions<DemoModeOptions>()
    .Bind(builder.Configuration.GetSection(DemoModeOptions.SectionName))
    .Validate(
        options => !options.Enabled ||
            (!string.IsNullOrWhiteSpace(options.ProtectedAdminEmail) &&
             options.Password.Length >= 12),
        "Kada je DemoMode uključen, ProtectedAdminEmail i Password od najmanje 12 znakova su obavezni.")
    .ValidateOnStart();
builder.Services.AddSingleton(jwtSettings);
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IRevokedTokenStore, DatabaseRevokedTokenStore>();
builder.Services.AddScoped<AuthBusinessRules>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IDemoAccessGuard, DemoAccessGuard>();
builder.Services.AddScoped<IOpremaRepository, OpremaRepository>();
builder.Services.AddScoped<IOpremaService, OpremaService>();
builder.Services.AddScoped<IEvidencijaRepository, EvidencijaRepository>();
builder.Services.AddScoped<IEvidencijaService, EvidencijaService>();
builder.Services.AddScoped<IObjekatRepository, ObjekatRepository>();
builder.Services.AddScoped<IObjekatService, ObjekatService>();
builder.Services.AddScoped<IKabinetRepository, KabinetRepository>();
builder.Services.AddScoped<IKabinetService, KabinetService>();
builder.Services.AddScoped<ITerminRepository, TerminRepository>();
builder.Services.AddScoped<ITerminValidator, TerminValidator>();
builder.Services.AddScoped<ITerminService, TerminService>();
builder.Services.AddScoped<IRezervacijaValidator, RezervacijaValidator>();
builder.Services.AddScoped<IRezervacijaService, RezervacijaService>();
builder.Services.AddScoped<IReservationReminderService, ReservationReminderService>();
builder.Services.AddScoped<IOpremaValidator, OpremaValidator>();
builder.Services.AddScoped<IOpremaService, OpremaService>();
builder.Services.AddScoped<IObavijestService, ObavijestService>();
builder.Services.AddHttpClient<IEmailNotificationService, ResendEmailNotificationService>();
builder.Services.AddHostedService<ReservationReminderBackgroundService>();
builder.Services.AddHostedService<DemoDataBackgroundService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var revokedTokenStore = context.HttpContext.RequestServices.GetRequiredService<IRevokedTokenStore>();
                var jti = context.Principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

                if (!string.IsNullOrWhiteSpace(jti) &&
                    await revokedTokenStore.IsRevokedAsync(jti, context.HttpContext.RequestAborted))
                {
                    context.Fail("Token has been revoked.");
                    return;
                }

                var userIdClaim = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdClaim, out var userId))
                {
                    context.Fail("User identifier claim is missing.");
                    return;
                }

                var dbContext = context.HttpContext.RequestServices.GetRequiredService<LabSistemDbContext>();
                var userState = await dbContext.Korisnici
                    .Where(x => x.ID == userId)
                    .Select(x => new { x.DeactivatedAt, x.MustChangePassword })
                    .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

                if (userState is null || userState.DeactivatedAt.HasValue)
                {
                    context.Fail("User account is inactive.");
                    return;
                }

                if (userState.MustChangePassword &&
                    context.Principal?.Identity is ClaimsIdentity identity &&
                    !identity.HasClaim("must_change_password", "true"))
                {
                    identity.AddClaim(new Claim("must_change_password", "true"));
                }
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<LabSistemDbContext>();
        if (!app.Environment.IsEnvironment("Testing"))
        {
            context.Database.Migrate();

            if (app.Configuration.GetValue<bool>("SeedData:DemoUsers"))
            {
                await LabSistemDbSeeder.SeedDefaultUsersAsync(context);
                await LabSistemDbSeeder.SeedDefaultObjektiAsync(context);
                await LabSistemDbSeeder.SeedDefaultKabinetiAsync(context);
            }

            if (app.Configuration.GetValue<bool>("BootstrapAdmin:Enabled"))
            {
                await LabSistemDbSeeder.SeedBootstrapAdminAsync(
                    context,
                    app.Configuration["BootstrapAdmin:Name"],
                    app.Configuration["BootstrapAdmin:Email"],
                    app.Configuration["BootstrapAdmin:Username"],
                    app.Configuration["BootstrapAdmin:Password"]);
            }

            Console.WriteLine("Migracije su uspjesno provjerene/primijenjene.");
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Greska pri migraciji: {ex.Message}");
        throw;
    }
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true &&
        string.Equals(
            context.User.FindFirst("must_change_password")?.Value,
            "true",
            StringComparison.OrdinalIgnoreCase))
    {
        var allowedPaths = new[]
        {
            "/api/Auth/change-password",
            "/api/Auth/logout",
            "/api/Auth/refresh"
        };

        var requestPath = context.Request.Path.Value ?? string.Empty;
        if (!allowedPaths.Contains(requestPath, StringComparer.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                Code = "PASSWORD_CHANGE_REQUIRED",
                Message = "Morate promijeniti privremenu lozinku prije nastavka rada."
            });
            return;
        }
    }

    await next();
});
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", async (LabSistemDbContext context, CancellationToken cancellationToken) =>
{
    try
    {
        return await context.Database.CanConnectAsync(cancellationToken)
            ? Results.Ok(new { status = "healthy" })
            : Results.Json(new { status = "unhealthy" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch
    {
        return Results.Json(new { status = "unhealthy" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapControllers();
app.Run();

static string NormalizeOrigin(string origin)
{
    var trimmedOrigin = origin.Trim().TrimEnd('/');
    if (!Uri.TryCreate(trimmedOrigin, UriKind.Absolute, out var uri) ||
        (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) ||
        uri.AbsolutePath != "/" ||
        !string.IsNullOrEmpty(uri.Query) ||
        !string.IsNullOrEmpty(uri.Fragment) ||
        !string.IsNullOrEmpty(uri.UserInfo))
    {
        throw new InvalidOperationException($"Neispravan CORS origin: {origin}");
    }

    return uri.GetLeftPart(UriPartial.Authority);
}

static void LoadDotEnvFile(string filePath)
{
    if (!File.Exists(filePath))
    {
        return;
    }

    foreach (var line in File.ReadAllLines(filePath))
    {
        var trimmedLine = line.Trim();
        if (string.IsNullOrWhiteSpace(trimmedLine) || trimmedLine.StartsWith('#'))
        {
            continue;
        }

        var separatorIndex = trimmedLine.IndexOf('=');
        if (separatorIndex <= 0)
        {
            continue;
        }

        var key = trimmedLine[..separatorIndex].Trim();
        var value = trimmedLine[(separatorIndex + 1)..].Trim().Trim('"');

        if (string.IsNullOrWhiteSpace(key) || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
        {
            continue;
        }

        Environment.SetEnvironmentVariable(key, value);
    }
}

public partial class Program { }
