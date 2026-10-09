using LABsistem.Domain.Enums;

namespace LABsistem.Domain;

public static class DemoAccounts
{
    public const string StudentUsername = "demo.student";
    public const string ProfessorUsername = "demo.profesor";
    public const string TechnicianUsername = "demo.tehnicar";

    public static readonly IReadOnlyList<DemoAccountDefinition> All =
    [
        new("student", "Student", StudentUsername, "demo.student@labsistem.local", UlogaKorisnika.Student),
        new("profesor", "Profesor", ProfessorUsername, "demo.profesor@labsistem.local", UlogaKorisnika.Profesor),
        new("tehnicar", "Tehničar", TechnicianUsername, "demo.tehnicar@labsistem.local", UlogaKorisnika.Tehnicar)
    ];

    public static bool IsDemoUsername(string? username) =>
        All.Any(account => string.Equals(account.Username, username, StringComparison.OrdinalIgnoreCase));

    public static DemoAccountDefinition? FindByRole(string? role) =>
        All.FirstOrDefault(account => string.Equals(account.RoleKey, role, StringComparison.OrdinalIgnoreCase));
}

public sealed record DemoAccountDefinition(
    string RoleKey,
    string Label,
    string Username,
    string Email,
    UlogaKorisnika Role);
