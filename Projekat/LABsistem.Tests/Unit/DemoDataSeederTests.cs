using LABsistem.Api.Services;
using LABsistem.Api.Validators;
using LABsistem.Dal.Db;
using LABsistem.Domain;
using LABsistem.Domain.Entities;
using LABsistem.Domain.Enums;
using LabSistem.Domain.Enums;
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
        Assert.Equal(8, await context.Oprema.CountAsync(oprema => oprema.SerijskiBroj >= 900001 && oprema.SerijskiBroj <= 900099));
        Assert.Equal(12, await context.Termini.CountAsync());
        Assert.Equal(4, await context.Zahtjevi.CountAsync());
        Assert.Equal(3, await context.Evidencije.CountAsync());
        Assert.Equal(6, await context.Obavijesti.CountAsync());
        Assert.Equal("Demo Student", (await context.Korisnici.SingleAsync(user => user.Username == DemoAccounts.StudentUsername)).ImePrezime);
        Assert.DoesNotContain(firstDemoObjectIds, id => context.Objekti.Any(objekat => objekat.ID == id));
    }

    [Fact]
    public async Task ResetAsync_SeedsBookableTermsAndConsistentReservationExamples()
    {
        using var context = GetInMemoryDbContext();
        var owner = NewUser("owner", "owner@example.com", UlogaKorisnika.Admin);
        context.Korisnici.Add(owner);
        await context.SaveChangesAsync();
        await DemoDataSeeder.ResetAsync(context, owner.Email, "DemoPassword123!");

        var student = await context.Korisnici.SingleAsync(user => user.Username == DemoAccounts.StudentUsername);
        var professor = await context.Korisnici.SingleAsync(user => user.Username == DemoAccounts.ProfessorUsername);
        var validator = new RezervacijaValidator(context);
        var service = new RezervacijaService(context, validator);
        var available = (await service.GetDostupniTerminiZaStudenteAsync(student.ID)).ToList();
        var bookable = available.Where(term => term.StatusPrijave == null).ToList();

        Assert.Equal(3, bookable.Count);
        foreach (var term in bookable)
        {
            Assert.True(term.Datum > DateTime.UtcNow);
            Assert.Equal("Rezervisan", term.StatusTermina);
            Assert.True(term.VidljivoStudentima);
            Assert.True(term.BrojOdobrenih < term.LimitOsoba);
            await validator.ValidateZahtjev(student.ID, term.ID);
        }

        Assert.Contains(available, term => term.StatusPrijave == "NaCekanju");
        Assert.Contains(available, term => term.StatusPrijave == "Odbijen");
        Assert.Contains(available, term => term.StatusPrijave == "Odobren");
        Assert.NotEmpty(await service.GetDolazniZahtjeviAsync(professor.ID));
        var reservations = (await service.GetMojeRezervacijeAsync(student.ID, "student")).ToList();
        Assert.Contains(reservations, term => term.Datum > DateTime.UtcNow);
        var professorReservations = await service.GetMojeRezervacijeAsync(professor.ID, "profesor");
        Assert.Contains(professorReservations, term => term.Datum < DateTime.UtcNow.Date);
        Assert.Equal(Enum.GetValues<StatusZahtjeva>().Length,
            await context.Zahtjevi.Select(request => request.StatusZahtjeva).Distinct().CountAsync());
        Assert.Contains(await context.Termini.ToListAsync(), term =>
            term.StatusTermina == StatusTermina.Slobodan && term.ProfesorID == null && !term.VidljivoStudentima);
        Assert.All(await context.Termini.Include(term => term.Kabinet).ToListAsync(), term =>
            Assert.True(!term.LimitOsoba.HasValue || term.LimitOsoba <= term.Kabinet.Kapacitet));

        foreach (var term in bookable)
        {
            await service.PosaljiZahtjev(student.ID, term.ID);
        }
        var pending = await service.GetDolazniZahtjeviAsync(professor.ID);
        foreach (var term in bookable)
        {
            Assert.Contains(pending, request => request.TerminID == term.ID);
        }
    }

    [Fact]
    public async Task ResetAsync_SeedsFaultsEquipmentAndReadUnreadNotifications()
    {
        using var context = GetInMemoryDbContext();
        var owner = NewUser("owner", "owner@example.com", UlogaKorisnika.Admin);
        context.Korisnici.Add(owner);
        await context.SaveChangesAsync();
        await DemoDataSeeder.ResetAsync(context, owner.Email, "DemoPassword123!");

        Assert.Equal(Enum.GetValues<StatusOpreme>().Length,
            await context.Oprema.Select(equipment => equipment.stanje).Distinct().CountAsync());
        var faults = await context.Evidencije.Include(fault => fault.Oprema).ToListAsync();
        Assert.Contains(faults, fault => fault.Status == "Kvar" && fault.Oprema.stanje == StatusOpreme.UKvaru);
        Assert.Contains(faults, fault => fault.Status == "U obradi" && fault.Oprema.stanje == StatusOpreme.NaServisu);
        Assert.Contains(faults, fault => fault.Status == "Rijeseno" && fault.RijesenoU >= fault.PrijavljenoU &&
            fault.Oprema.stanje == StatusOpreme.Ispravno && !string.IsNullOrWhiteSpace(fault.Rjesenje));
        foreach (var user in await context.Korisnici.Where(user => user.Username.StartsWith("demo.")).ToListAsync())
        {
            var notifications = await context.Obavijesti.Where(notification => notification.KorisnikID == user.ID).ToListAsync();
            Assert.Contains(notifications, notification => notification.Dostupnost);
            Assert.Contains(notifications, notification => !notification.Dostupnost);
        }
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
