using LABsistem.Domain;
using LABsistem.Domain.Entities;
using LABsistem.Domain.Enums;
using LabSistem.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace LABsistem.Dal.Db;

public static class DemoDataSeeder
{
    public const string DemoObjectPrefix = "DEMO -";
    public const int DemoSerialNumberStart = 900001;
    public const int DemoSerialNumberEnd = 900099;

    public static async Task ResetAsync(
        LabSistemDbContext context,
        string protectedAdminEmail,
        string demoPassword,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(protectedAdminEmail))
        {
            throw new InvalidOperationException("DemoMode:ProtectedAdminEmail mora biti konfigurisan.");
        }

        if (string.IsNullOrWhiteSpace(demoPassword) || demoPassword.Length < 8)
        {
            throw new InvalidOperationException("DemoMode:Password mora imati najmanje 8 karaktera.");
        }

        var normalizedProtectedEmail = protectedAdminEmail.Trim();
        var protectedAdminExists = await context.Korisnici.AnyAsync(
            user => user.Email == normalizedProtectedEmail &&
                    user.Uloga == UlogaKorisnika.Admin &&
                    user.DeactivatedAt == null,
            cancellationToken);

        if (!protectedAdminExists)
        {
            throw new InvalidOperationException(
                "Demo reset nije pokrenut jer zaštićeni aktivni administrator nije pronađen.");
        }

        IDbContextTransaction? transaction = null;
        if (context.Database.IsRelational())
        {
            transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        }

        try
        {
            await RemoveExistingDemoDataAsync(context, cancellationToken);
            var users = await UpsertDemoUsersAsync(context, demoPassword, cancellationToken);
            await SeedDemoWorkspaceAsync(context, users, cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private static async Task RemoveExistingDemoDataAsync(
        LabSistemDbContext context,
        CancellationToken cancellationToken)
    {
        var usernames = DemoAccounts.All.Select(account => account.Username).ToArray();
        var demoUserIds = await context.Korisnici
            .Where(user => usernames.Contains(user.Username))
            .Select(user => user.ID)
            .ToListAsync(cancellationToken);

        var demoObjectIds = await context.Objekti
            .Where(objekat => objekat.Lokacija.StartsWith(DemoObjectPrefix))
            .Select(objekat => objekat.ID)
            .ToListAsync(cancellationToken);

        var demoCabinetIds = await context.Kabineti
            .Where(kabinet => demoObjectIds.Contains(kabinet.ObjekatID) || kabinet.Naziv.StartsWith("DEMO "))
            .Select(kabinet => kabinet.ID)
            .ToListAsync(cancellationToken);

        var demoEquipmentIds = await context.Oprema
            .Where(oprema => demoUserIds.Contains(oprema.KreatorID) ||
                             demoCabinetIds.Contains(oprema.KabinetID) ||
                             (oprema.SerijskiBroj >= DemoSerialNumberStart &&
                              oprema.SerijskiBroj <= DemoSerialNumberEnd))
            .Select(oprema => oprema.ID)
            .ToListAsync(cancellationToken);

        var demoTermIds = await context.Termini
            .Where(termin => demoUserIds.Contains(termin.KreatorID) ||
                            (termin.ProfesorID.HasValue && demoUserIds.Contains(termin.ProfesorID.Value)) ||
                            demoCabinetIds.Contains(termin.KabinetID))
            .Select(termin => termin.ID)
            .ToListAsync(cancellationToken);

        var demoRequestIds = await context.Zahtjevi
            .Where(zahtjev => demoUserIds.Contains(zahtjev.StudentID) || demoTermIds.Contains(zahtjev.TerminID))
            .Select(zahtjev => zahtjev.ID)
            .ToListAsync(cancellationToken);

        context.ReservationReminderDispatches.RemoveRange(
            await context.ReservationReminderDispatches
                .Where(dispatch => demoRequestIds.Contains(dispatch.ZahtjevID))
                .ToListAsync(cancellationToken));
        context.Obavijesti.RemoveRange(
            await context.Obavijesti
                .Where(notification => demoUserIds.Contains(notification.KorisnikID) ||
                                       (notification.TerminID.HasValue && demoTermIds.Contains(notification.TerminID.Value)))
                .ToListAsync(cancellationToken));
        context.Evidencije.RemoveRange(
            await context.Evidencije
                .Where(record => demoUserIds.Contains(record.KorisnikID) ||
                                 (record.ProfesorID.HasValue && demoUserIds.Contains(record.ProfesorID.Value)) ||
                                 (record.ObradioKorisnikID.HasValue && demoUserIds.Contains(record.ObradioKorisnikID.Value)) ||
                                 demoEquipmentIds.Contains(record.OpremaID) ||
                                 (record.TerminID.HasValue && demoTermIds.Contains(record.TerminID.Value)))
                .ToListAsync(cancellationToken));
        context.Zahtjevi.RemoveRange(
            await context.Zahtjevi
                .Where(request => demoRequestIds.Contains(request.ID))
                .ToListAsync(cancellationToken));
        context.HistorijaTermini.RemoveRange(
            await context.HistorijaTermini
                .Where(historyTerm => demoTermIds.Contains(historyTerm.TerminID))
                .ToListAsync(cancellationToken));
        context.Historije.RemoveRange(
            await context.Historije
                .Where(history => demoTermIds.Contains(history.TerminID))
                .ToListAsync(cancellationToken));
        context.OpremaRecenzije.RemoveRange(
            await context.OpremaRecenzije
                .Where(review => demoEquipmentIds.Contains(review.OpremaID))
                .ToListAsync(cancellationToken));
        context.Termini.RemoveRange(
            await context.Termini.Where(term => demoTermIds.Contains(term.ID)).ToListAsync(cancellationToken));
        context.Oprema.RemoveRange(
            await context.Oprema.Where(equipment => demoEquipmentIds.Contains(equipment.ID)).ToListAsync(cancellationToken));
        context.KorisnikObjekti.RemoveRange(
            await context.KorisnikObjekti
                .Where(link => demoUserIds.Contains(link.KorisnikID) || demoObjectIds.Contains(link.ObjekatID))
                .ToListAsync(cancellationToken));
        context.Kabineti.RemoveRange(
            await context.Kabineti.Where(cabinet => demoCabinetIds.Contains(cabinet.ID)).ToListAsync(cancellationToken));
        context.Objekti.RemoveRange(
            await context.Objekti.Where(objekat => demoObjectIds.Contains(objekat.ID)).ToListAsync(cancellationToken));
        context.RefreshTokens.RemoveRange(
            await context.RefreshTokens.Where(token => demoUserIds.Contains(token.KorisnikID)).ToListAsync(cancellationToken));
        context.PasswordResetTokens.RemoveRange(
            await context.PasswordResetTokens.Where(token => demoUserIds.Contains(token.KorisnikID)).ToListAsync(cancellationToken));
        context.EmailVerificationTokens.RemoveRange(
            await context.EmailVerificationTokens.Where(token => demoUserIds.Contains(token.KorisnikID)).ToListAsync(cancellationToken));

        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task<Dictionary<string, Korisnik>> UpsertDemoUsersAsync(
        LabSistemDbContext context,
        string demoPassword,
        CancellationToken cancellationToken)
    {
        var usernames = DemoAccounts.All.Select(account => account.Username).ToArray();
        var existingUsers = await context.Korisnici
            .Where(user => usernames.Contains(user.Username))
            .ToDictionaryAsync(user => user.Username, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(demoPassword);

        foreach (var account in DemoAccounts.All)
        {
            if (!existingUsers.TryGetValue(account.Username, out var user))
            {
                user = new Korisnik { Username = account.Username };
                context.Korisnici.Add(user);
                existingUsers[account.Username] = user;
            }

            user.ImePrezime = $"Demo {account.Label}";
            user.Email = account.Email;
            user.Password = passwordHash;
            user.Uloga = account.Role;
            user.EmailVerified = true;
            user.EmailVerifiedAtUtc = DateTime.UtcNow;
            user.MustChangePassword = false;
            user.DeactivatedAt = null;
        }

        await context.SaveChangesAsync(cancellationToken);
        return existingUsers;
    }

    private static async Task SeedDemoWorkspaceAsync(
        LabSistemDbContext context,
        IReadOnlyDictionary<string, Korisnik> users,
        CancellationToken cancellationToken)
    {
        var student = users[DemoAccounts.StudentUsername];
        var professor = users[DemoAccounts.ProfessorUsername];
        var technician = users[DemoAccounts.TechnicianUsername];

        var etf = new Objekat { Lokacija = "DEMO - ETF A", RadnoVrijeme = "08:00-20:00" };
        var research = new Objekat { Lokacija = "DEMO - Lab centar", RadnoVrijeme = "07:30-21:00" };
        context.Objekti.AddRange(etf, research);
        await context.SaveChangesAsync(cancellationToken);

        var softwareLab = new Kabinet
        {
            Naziv = "DEMO A-101",
            Kapacitet = 24,
            KorisnikID = technician.ID,
            ObjekatID = etf.ID
        };
        var networkLab = new Kabinet
        {
            Naziv = "DEMO A-203",
            Kapacitet = 18,
            KorisnikID = technician.ID,
            ObjekatID = etf.ID
        };
        var electronicsLab = new Kabinet
        {
            Naziv = "DEMO L-12",
            Kapacitet = 14,
            KorisnikID = technician.ID,
            ObjekatID = research.ID
        };
        context.Kabineti.AddRange(softwareLab, networkLab, electronicsLab);
        await context.SaveChangesAsync(cancellationToken);

        var equipment = new[]
        {
            new Oprema { Naziv = "Radna stanica 01", Kategorija = "Računar", SerijskiBroj = 900001, stanje = StatusOpreme.Ispravno, KreatorID = technician.ID, KabinetID = softwareLab.ID },
            new Oprema { Naziv = "Projektor A101", Kategorija = "Projektor", SerijskiBroj = 900002, stanje = StatusOpreme.Ispravno, KreatorID = technician.ID, KabinetID = softwareLab.ID },
            new Oprema { Naziv = "Cisco switch 24P", Kategorija = "Mrežna oprema", SerijskiBroj = 900003, stanje = StatusOpreme.UKvaru, KreatorID = technician.ID, KabinetID = networkLab.ID },
            new Oprema { Naziv = "Osciloskop", Kategorija = "Mjerni uređaj", SerijskiBroj = 900004, stanje = StatusOpreme.NaServisu, KreatorID = technician.ID, KabinetID = electronicsLab.ID },
            new Oprema { Naziv = "Laptop za nastavu", Kategorija = "Računar", SerijskiBroj = 900005, stanje = StatusOpreme.Ispravno, KreatorID = technician.ID, KabinetID = networkLab.ID },
            new Oprema { Naziv = "3D printer", Kategorija = "Laboratorijska oprema", SerijskiBroj = 900006, stanje = StatusOpreme.Ispravno, KreatorID = technician.ID, KabinetID = electronicsLab.ID },
            new Oprema { Naziv = "Monitor za rashod", Kategorija = "Monitor", SerijskiBroj = 900007, stanje = StatusOpreme.Otpisano, KreatorID = technician.ID, KabinetID = networkLab.ID },
            new Oprema { Naziv = "Digitalni multimetar", Kategorija = "Mjerni uređaj", SerijskiBroj = 900008, stanje = StatusOpreme.Ispravno, KreatorID = technician.ID, KabinetID = electronicsLab.ID }
        };
        context.Oprema.AddRange(equipment);

        var today = DateTime.UtcNow.Date;
        var terms = new[]
        {
            NewTerm(today.AddDays(3), new TimeSpan(9, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, true),
            NewTerm(today.AddDays(4), new TimeSpan(12, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, true),
            NewTerm(today.AddDays(5), new TimeSpan(15, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, true),
            NewTerm(today.AddDays(-2), new TimeSpan(10, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, false),
            NewTerm(today.AddDays(2), new TimeSpan(9, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, true, 6),
            NewTerm(today.AddDays(6), new TimeSpan(13, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, true, 18),
            NewTerm(today.AddDays(7), new TimeSpan(15, 0, 0), electronicsLab.ID, professor.ID, StatusTermina.Rezervisan, true, 8),
            NewTerm(today.AddDays(3), new TimeSpan(14, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, false, 4),
            NewTerm(today.AddDays(2), new TimeSpan(12, 0, 0), networkLab.ID, technician.ID, StatusTermina.Slobodan, false),
            NewTerm(today.AddDays(4), new TimeSpan(15, 0, 0), electronicsLab.ID, professor.ID, StatusTermina.Otkazan, false),
            NewTerm(today, new TimeSpan(16, 0, 0), softwareLab.ID, professor.ID, StatusTermina.Rezervisan, false),
            NewTerm(today.AddDays(-1), new TimeSpan(10, 0, 0), networkLab.ID, professor.ID, StatusTermina.Rezervisan, false)
        };
        context.Termini.AddRange(terms);
        await context.SaveChangesAsync(cancellationToken);

        context.Zahtjevi.AddRange(
            new Zahtjev { StudentID = student.ID, TerminID = terms[0].ID, Komentar = "Vježbe iz baza podataka", StatusZahtjeva = StatusZahtjeva.Odobren },
            new Zahtjev { StudentID = student.ID, TerminID = terms[1].ID, Komentar = "Priprema laboratorijske vježbe", StatusZahtjeva = StatusZahtjeva.NaCekanju },
            new Zahtjev { StudentID = student.ID, TerminID = terms[2].ID, Komentar = "Rad na projektnom zadatku", StatusZahtjeva = StatusZahtjeva.Odbijen },
            new Zahtjev { StudentID = student.ID, TerminID = terms[9].ID, Komentar = "Termin otkazan zbog servisa opreme", StatusZahtjeva = StatusZahtjeva.Otkazan });

        context.Evidencije.AddRange(
            new Evidencija
            {
                PrijavljenoU = DateTime.UtcNow.AddHours(-5),
                Status = "Kvar",
                Komentar = "Mrežni switch povremeno gubi konekciju.",
                OpremaID = equipment[2].ID,
                KorisnikID = professor.ID,
                ProfesorID = professor.ID
            },
            new Evidencija
            {
                PrijavljenoU = DateTime.UtcNow.AddDays(-1),
                Status = "U obradi",
                Komentar = "Osciloskop ne prikazuje signal na drugom kanalu.",
                OpremaID = equipment[3].ID,
                KorisnikID = student.ID,
                ObradioKorisnikID = technician.ID,
                Rjesenje = "Uređaj je poslan na dijagnostiku i kalibraciju."
            },
            new Evidencija
            {
                PrijavljenoU = DateTime.UtcNow.AddDays(-4),
                RijesenoU = DateTime.UtcNow.AddDays(-3),
                Status = "Rijeseno",
                Komentar = "Projektor se gasio nakon nekoliko minuta rada.",
                Rjesenje = "Očišćen filter i zamijenjen ventilator. Projektor je testiran i vraćen u upotrebu.",
                OpremaID = equipment[1].ID,
                KorisnikID = professor.ID,
                ProfesorID = professor.ID,
                ObradioKorisnikID = technician.ID
            });

        context.Obavijesti.AddRange(
            new Obavijest { KorisnikID = student.ID, TerminID = terms[0].ID, Novosti = "Zahtjev za termin je odobren.", Dostupnost = false, DatumKreiranja = DateTime.UtcNow.AddHours(-2) },
            new Obavijest { KorisnikID = student.ID, TerminID = terms[9].ID, Novosti = "Termin je otkazan zbog servisa opreme.", Dostupnost = true, DatumKreiranja = DateTime.UtcNow.AddDays(-1) },
            new Obavijest { KorisnikID = professor.ID, TerminID = terms[1].ID, Novosti = "Novi zahtjev studenta čeka odobrenje.", Dostupnost = false, DatumKreiranja = DateTime.UtcNow.AddHours(-1) },
            new Obavijest { KorisnikID = professor.ID, Novosti = "Projektor A101 je popravljen i vraćen u upotrebu.", Dostupnost = true, DatumKreiranja = DateTime.UtcNow.AddDays(-3) },
            new Obavijest { KorisnikID = technician.ID, Novosti = "Nova prijava kvara mrežnog switcha čeka pregled.", Dostupnost = false, DatumKreiranja = DateTime.UtcNow.AddHours(-5) },
            new Obavijest { KorisnikID = technician.ID, Novosti = "Dodijeljena vam je prijava za osciloskop.", Dostupnost = true, DatumKreiranja = DateTime.UtcNow.AddDays(-1) });

        await context.SaveChangesAsync(cancellationToken);
    }

    private static Termin NewTerm(
        DateTime date,
        TimeSpan start,
        int cabinetId,
        int professorId,
        StatusTermina status,
        bool visible,
        int limit = 12) =>
        new()
        {
            Datum = date,
            VrijemePocetka = start,
            VrijemeKraja = start.Add(TimeSpan.FromHours(2)),
            KreatorID = professorId,
            ProfesorID = status == StatusTermina.Slobodan ? null : professorId,
            KabinetID = cabinetId,
            StatusTermina = status,
            LimitOsoba = status == StatusTermina.Slobodan ? null : limit,
            VidljivoStudentima = visible
        };
}
