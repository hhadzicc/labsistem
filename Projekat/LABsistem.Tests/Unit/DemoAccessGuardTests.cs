using LABsistem.Dal.Db;
using LABsistem.Domain;
using LABsistem.Domain.Entities;
using LABsistem.Domain.Enums;
using LABsistem.Presentation.Services;
using Microsoft.EntityFrameworkCore;

public class DemoAccessGuardTests
{
    [Fact]
    public async Task Guard_RecognizesOnlyRecordsFromDemoWorkspace()
    {
        await using var context = CreateContext();
        var owner = NewUser("owner", "owner@example.com", UlogaKorisnika.Admin);
        var ordinaryUser = NewUser("ordinary", "ordinary@example.com", UlogaKorisnika.Tehnicar);
        var ordinaryObject = new Objekat { Lokacija = "ETF Sarajevo", RadnoVrijeme = "08:00-20:00" };
        context.AddRange(owner, ordinaryUser, ordinaryObject);
        await context.SaveChangesAsync();

        var ordinaryCabinet = new Kabinet
        {
            Naziv = "A-01",
            Kapacitet = 20,
            KorisnikID = ordinaryUser.ID,
            ObjekatID = ordinaryObject.ID
        };
        context.Kabineti.Add(ordinaryCabinet);
        await context.SaveChangesAsync();

        var ordinaryEquipment = new Oprema
        {
            Naziv = "Laptop",
            Kategorija = "Računar",
            SerijskiBroj = 12345,
            stanje = StatusOpreme.Ispravno,
            KreatorID = ordinaryUser.ID,
            KabinetID = ordinaryCabinet.ID
        };
        context.Oprema.Add(ordinaryEquipment);
        await context.SaveChangesAsync();

        await DemoDataSeeder.ResetAsync(context, owner.Email, "DemoPassword123!");
        var guard = new DemoAccessGuard(context);

        var demoCabinetId = await context.Kabineti
            .Where(cabinet => cabinet.Naziv.StartsWith("DEMO "))
            .Select(cabinet => cabinet.ID)
            .FirstAsync();
        var demoEquipmentId = await context.Oprema
            .Where(equipment => equipment.SerijskiBroj >= DemoDataSeeder.DemoSerialNumberStart)
            .Select(equipment => equipment.ID)
            .FirstAsync();
        var demoTermId = await context.Termini.Select(term => term.ID).FirstAsync();
        var demoEvidenceId = await context.Evidencije.Select(evidence => evidence.ID).FirstAsync();
        var demoRequestId = await context.Zahtjevi.Select(request => request.ID).FirstAsync();

        Assert.True(await guard.IsDemoCabinetAsync(demoCabinetId));
        Assert.True(await guard.IsDemoEquipmentAsync(demoEquipmentId));
        Assert.True(await guard.IsDemoTermAsync(demoTermId));
        Assert.True(await guard.IsDemoEvidenceAsync(demoEvidenceId));
        Assert.True(await guard.IsDemoRequestAsync(demoRequestId));
        Assert.False(await guard.IsDemoCabinetAsync(ordinaryCabinet.ID));
        Assert.False(await guard.IsDemoEquipmentAsync(ordinaryEquipment.ID));
        var visibleCabinets = await guard.GetDemoCabinetIdsAsync([demoCabinetId, ordinaryCabinet.ID]);
        var visibleEquipment = await guard.GetDemoEquipmentIdsAsync([demoEquipmentId, ordinaryEquipment.ID]);
        Assert.Single(visibleCabinets);
        Assert.Contains(demoCabinetId, visibleCabinets);
        Assert.Single(visibleEquipment);
        Assert.Contains(demoEquipmentId, visibleEquipment);
    }

    private static LabSistemDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<LabSistemDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new LabSistemDbContext(options);
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
