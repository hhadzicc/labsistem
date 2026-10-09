using LABsistem.Dal.Db;
using LABsistem.Domain;
using LABsistem.Domain.Entities;
using LABsistem.Domain.Enums;
using Microsoft.EntityFrameworkCore;

public class DemoDataSeederTests
{
    private static LabSistemDbContext GetInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<LabSistemDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new LabSistemDbContext(options);
    }

    [Fact]
    public async Task ResetAsync_PreservesOrdinaryDataAndRecreatesDemoWorkspace()
    {
        using var context = GetInMemoryDbContext();
        var owner = NewUser("owner", "owner@example.com", UlogaKorisnika.Admin);
        var ordinaryUser = NewUser("ordinary.student", "ordinary@example.com", UlogaKorisnika.Student);
        var ordinaryObject = new Objekat { Lokacija = "ETF Sarajevo", RadnoVrijeme = "08:00-20:00" };
        context.Korisnici.AddRange(owner, ordinaryUser);
        context.Objekti.Add(ordinaryObject);
        await context.SaveChangesAsync();

        await DemoDataSeeder.ResetAsync(context, owner.Email, "DemoPassword123!");
        var firstDemoObjectIds = await context.Objekti
            .Where(objekat => objekat.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix))
            .Select(objekat => objekat.ID)
            .ToListAsync();

        var demoStudent = await context.Korisnici.SingleAsync(user => user.Username == DemoAccounts.StudentUsername);
        demoStudent.ImePrezime = "Promijenjeno ime";
        context.Objekti.Add(new Objekat { Lokacija = "DEMO - Privremeno", RadnoVrijeme = "00:00-00:01" });
        await context.SaveChangesAsync();

        await DemoDataSeeder.ResetAsync(context, owner.Email, "DemoPassword123!");

        Assert.NotNull(await context.Korisnici.FindAsync(owner.ID));
        Assert.NotNull(await context.Korisnici.FindAsync(ordinaryUser.ID));
        Assert.NotNull(await context.Objekti.FindAsync(ordinaryObject.ID));
        Assert.Equal(3, await context.Korisnici.CountAsync(user => user.Username.StartsWith("demo.")));
        Assert.Equal(2, await context.Objekti.CountAsync(objekat => objekat.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix)));
        Assert.Equal(3, await context.Kabineti.CountAsync(kabinet => kabinet.Naziv.StartsWith("DEMO ")));
        Assert.Equal(6, await context.Oprema.CountAsync(oprema => oprema.SerijskiBroj >= 900001 && oprema.SerijskiBroj <= 900099));
        Assert.Equal("Demo Student", (await context.Korisnici.SingleAsync(user => user.Username == DemoAccounts.StudentUsername)).ImePrezime);
        Assert.DoesNotContain(firstDemoObjectIds, id => context.Objekti.Any(objekat => objekat.ID == id));
    }

    [Fact]
    public async Task ResetAsync_WithoutProtectedAdmin_DoesNotChangeDatabase()
    {
        using var context = GetInMemoryDbContext();
        var ordinaryUser = NewUser("ordinary.student", "ordinary@example.com", UlogaKorisnika.Student);
        context.Korisnici.Add(ordinaryUser);
        await context.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DemoDataSeeder.ResetAsync(context, "missing-owner@example.com", "DemoPassword123!"));

        Assert.Single(await context.Korisnici.ToListAsync());
        Assert.Empty(await context.Objekti.ToListAsync());
    }

    private static Korisnik NewUser(string username, string email, UlogaKorisnika role) =>
        new()
        {
            ImePrezime = username,
            Email = email,
            EmailVerified = true,
            EmailVerifiedAtUtc = DateTime.UtcNow,
            Username = username,
            Password = BCrypt.Net.BCrypt.HashPassword("ValidPassword123!"),
            Uloga = role
        };
}
