namespace LABsistem.Presentation.Configuration;

public sealed class DemoModeOptions
{
    public const string SectionName = "DemoMode";

    public bool Enabled { get; set; }

    public int ResetIntervalMinutes { get; set; } = 60;

    public string ProtectedAdminEmail { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}
