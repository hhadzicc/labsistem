using LABsistem.Dal.Db;
using LABsistem.Domain;
using Microsoft.EntityFrameworkCore;

namespace LABsistem.Presentation.Services;

public interface IDemoAccessGuard
{
    Task<HashSet<int>> GetDemoObjectIdsAsync(IEnumerable<int> candidateIds, CancellationToken cancellationToken = default);
    Task<HashSet<int>> GetDemoCabinetIdsAsync(IEnumerable<int> candidateIds, CancellationToken cancellationToken = default);
    Task<HashSet<int>> GetDemoEquipmentIdsAsync(IEnumerable<int> candidateIds, CancellationToken cancellationToken = default);
    Task<HashSet<int>> GetDemoTermIdsAsync(IEnumerable<int> candidateIds, CancellationToken cancellationToken = default);
    Task<HashSet<int>> GetDemoEvidenceIdsAsync(IEnumerable<int> candidateIds, CancellationToken cancellationToken = default);
    Task<bool> IsDemoCabinetAsync(int cabinetId, CancellationToken cancellationToken = default);
    Task<bool> IsDemoEquipmentAsync(int equipmentId, CancellationToken cancellationToken = default);
    Task<bool> IsDemoTermAsync(int termId, CancellationToken cancellationToken = default);
    Task<bool> IsDemoEvidenceAsync(int evidenceId, CancellationToken cancellationToken = default);
    Task<bool> IsDemoRequestAsync(int requestId, CancellationToken cancellationToken = default);
}

public sealed class DemoAccessGuard : IDemoAccessGuard
{
    private readonly LabSistemDbContext _context;

    public DemoAccessGuard(LabSistemDbContext context)
    {
        _context = context;
    }

    public async Task<HashSet<int>> GetDemoObjectIdsAsync(
        IEnumerable<int> candidateIds,
        CancellationToken cancellationToken = default)
    {
        var ids = candidateIds.Distinct().ToArray();
        return (await _context.Objekti
                .AsNoTracking()
                .Where(building => ids.Contains(building.ID) &&
                                   building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix))
                .Select(building => building.ID)
                .ToListAsync(cancellationToken))
            .ToHashSet();
    }

    public async Task<HashSet<int>> GetDemoCabinetIdsAsync(
        IEnumerable<int> candidateIds,
        CancellationToken cancellationToken = default)
    {
        var ids = candidateIds.Distinct().ToArray();
        return (await (from cabinet in _context.Kabineti.AsNoTracking()
                       join building in _context.Objekti.AsNoTracking() on cabinet.ObjekatID equals building.ID
                       where ids.Contains(cabinet.ID) &&
                             building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix)
                       select cabinet.ID).ToListAsync(cancellationToken))
            .ToHashSet();
    }

    public async Task<HashSet<int>> GetDemoEquipmentIdsAsync(
        IEnumerable<int> candidateIds,
        CancellationToken cancellationToken = default)
    {
        var ids = candidateIds.Distinct().ToArray();
        var demoUsernames = DemoAccounts.All.Select(account => account.Username).ToArray();
        return (await (from equipment in _context.Oprema.AsNoTracking()
                       join creator in _context.Korisnici.AsNoTracking() on equipment.KreatorID equals creator.ID
                       join cabinet in _context.Kabineti.AsNoTracking() on equipment.KabinetID equals cabinet.ID
                       join building in _context.Objekti.AsNoTracking() on cabinet.ObjekatID equals building.ID
                       where ids.Contains(equipment.ID) &&
                             ((equipment.SerijskiBroj >= DemoDataSeeder.DemoSerialNumberStart &&
                               equipment.SerijskiBroj <= DemoDataSeeder.DemoSerialNumberEnd) ||
                              demoUsernames.Contains(creator.Username) ||
                              building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix))
                       select equipment.ID).ToListAsync(cancellationToken))
            .ToHashSet();
    }

    public async Task<HashSet<int>> GetDemoTermIdsAsync(
        IEnumerable<int> candidateIds,
        CancellationToken cancellationToken = default)
    {
        var ids = candidateIds.Distinct().ToArray();
        var demoUsernames = DemoAccounts.All.Select(account => account.Username).ToArray();
        return (await (from term in _context.Termini.AsNoTracking()
                       join creator in _context.Korisnici.AsNoTracking() on term.KreatorID equals creator.ID
                       join cabinet in _context.Kabineti.AsNoTracking() on term.KabinetID equals cabinet.ID
                       join building in _context.Objekti.AsNoTracking() on cabinet.ObjekatID equals building.ID
                       where ids.Contains(term.ID) &&
                             (demoUsernames.Contains(creator.Username) ||
                              building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix))
                       select term.ID).ToListAsync(cancellationToken))
            .ToHashSet();
    }

    public async Task<HashSet<int>> GetDemoEvidenceIdsAsync(
        IEnumerable<int> candidateIds,
        CancellationToken cancellationToken = default)
    {
        var ids = candidateIds.Distinct().ToArray();
        var candidates = await _context.Evidencije
            .AsNoTracking()
            .Where(evidence => ids.Contains(evidence.ID))
            .Select(evidence => new { evidence.ID, evidence.OpremaID, evidence.TerminID })
            .ToListAsync(cancellationToken);
        var demoEquipmentIds = await GetDemoEquipmentIdsAsync(candidates.Select(item => item.OpremaID), cancellationToken);
        var demoTermIds = await GetDemoTermIdsAsync(
            candidates.Where(item => item.TerminID.HasValue).Select(item => item.TerminID!.Value),
            cancellationToken);

        return candidates
            .Where(item => demoEquipmentIds.Contains(item.OpremaID) ||
                           (item.TerminID.HasValue && demoTermIds.Contains(item.TerminID.Value)))
            .Select(item => item.ID)
            .ToHashSet();
    }

    public Task<bool> IsDemoCabinetAsync(int cabinetId, CancellationToken cancellationToken = default) =>
        (from cabinet in _context.Kabineti.AsNoTracking()
         join building in _context.Objekti.AsNoTracking() on cabinet.ObjekatID equals building.ID
         where cabinet.ID == cabinetId && building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix)
         select cabinet.ID).AnyAsync(cancellationToken);

    public Task<bool> IsDemoEquipmentAsync(int equipmentId, CancellationToken cancellationToken = default)
    {
        var demoUsernames = DemoAccounts.All.Select(account => account.Username).ToArray();

        return (from equipment in _context.Oprema.AsNoTracking()
                join creator in _context.Korisnici.AsNoTracking() on equipment.KreatorID equals creator.ID
                join cabinet in _context.Kabineti.AsNoTracking() on equipment.KabinetID equals cabinet.ID
                join building in _context.Objekti.AsNoTracking() on cabinet.ObjekatID equals building.ID
                where equipment.ID == equipmentId &&
                      ((equipment.SerijskiBroj >= DemoDataSeeder.DemoSerialNumberStart &&
                        equipment.SerijskiBroj <= DemoDataSeeder.DemoSerialNumberEnd) ||
                       demoUsernames.Contains(creator.Username) ||
                       building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix))
                select equipment.ID).AnyAsync(cancellationToken);
    }

    public Task<bool> IsDemoTermAsync(int termId, CancellationToken cancellationToken = default)
    {
        var demoUsernames = DemoAccounts.All.Select(account => account.Username).ToArray();

        return (from term in _context.Termini.AsNoTracking()
                join creator in _context.Korisnici.AsNoTracking() on term.KreatorID equals creator.ID
                join cabinet in _context.Kabineti.AsNoTracking() on term.KabinetID equals cabinet.ID
                join building in _context.Objekti.AsNoTracking() on cabinet.ObjekatID equals building.ID
                where term.ID == termId &&
                      (demoUsernames.Contains(creator.Username) ||
                       building.Lokacija.StartsWith(DemoDataSeeder.DemoObjectPrefix))
                select term.ID).AnyAsync(cancellationToken);
    }

    public async Task<bool> IsDemoEvidenceAsync(int evidenceId, CancellationToken cancellationToken = default)
    {
        var evidence = await _context.Evidencije
            .AsNoTracking()
            .Where(item => item.ID == evidenceId)
            .Select(item => new
            {
                item.OpremaID,
                item.TerminID,
                item.KorisnikID,
                item.ProfesorID,
                item.ObradioKorisnikID
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (evidence is null)
        {
            return false;
        }

        if (await IsDemoEquipmentAsync(evidence.OpremaID, cancellationToken) ||
            (evidence.TerminID.HasValue && await IsDemoTermAsync(evidence.TerminID.Value, cancellationToken)))
        {
            return true;
        }

        var relatedUserIds = new[]
            {
                (int?)evidence.KorisnikID,
                evidence.ProfesorID,
                evidence.ObradioKorisnikID
            }
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToArray();

        var demoUsernames = DemoAccounts.All.Select(account => account.Username).ToArray();
        return await _context.Korisnici
            .AsNoTracking()
            .AnyAsync(user => relatedUserIds.Contains(user.ID) && demoUsernames.Contains(user.Username), cancellationToken);
    }

    public async Task<bool> IsDemoRequestAsync(int requestId, CancellationToken cancellationToken = default)
    {
        var request = await _context.Zahtjevi
            .AsNoTracking()
            .Where(item => item.ID == requestId)
            .Select(item => new { item.StudentID, item.TerminID })
            .SingleOrDefaultAsync(cancellationToken);

        if (request is null)
        {
            return false;
        }

        if (await IsDemoTermAsync(request.TerminID, cancellationToken))
        {
            return true;
        }

        var demoUsernames = DemoAccounts.All.Select(account => account.Username).ToArray();
        return await _context.Korisnici
            .AsNoTracking()
            .AnyAsync(user => user.ID == request.StudentID && demoUsernames.Contains(user.Username), cancellationToken);
    }
}
