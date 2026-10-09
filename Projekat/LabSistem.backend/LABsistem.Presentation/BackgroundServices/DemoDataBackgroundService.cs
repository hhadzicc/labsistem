using LABsistem.Dal.Db;
using LABsistem.Presentation.Configuration;
using Microsoft.Extensions.Options;

namespace LABsistem.Presentation.BackgroundServices;

public sealed class DemoDataBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly DemoModeOptions _options;
    private readonly ILogger<DemoDataBackgroundService> _logger;

    public DemoDataBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<DemoModeOptions> options,
        ILogger<DemoDataBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            return;
        }

        var resetInterval = TimeSpan.FromMinutes(Math.Max(15, _options.ResetIntervalMinutes));
        await ResetDemoDataAsync(stoppingToken);

        using var timer = new PeriodicTimer(resetInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await ResetDemoDataAsync(stoppingToken);
        }
    }

    private async Task ResetDemoDataAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<LabSistemDbContext>();
            await DemoDataSeeder.ResetAsync(
                context,
                _options.ProtectedAdminEmail,
                _options.Password,
                cancellationToken);

            _logger.LogInformation(
                "Demo podaci su vraćeni na početno stanje. Sljedeći reset je za {ResetMinutes} minuta.",
                Math.Max(15, _options.ResetIntervalMinutes));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Automatski reset demo podataka nije uspio.");
        }
    }
}
