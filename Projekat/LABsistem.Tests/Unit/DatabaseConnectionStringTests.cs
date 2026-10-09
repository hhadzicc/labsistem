using LABsistem.Presentation.Configuration;
using Npgsql;

namespace LABsistem.Tests.Unit;

public sealed class DatabaseConnectionStringTests
{
    [Fact]
    public void Normalize_NeonUrl_ProducesNpgsqlConnectionString()
    {
        const string neonUrl =
            "postgresql://neondb_owner:p%40ssword@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

        var normalized = DatabaseConnectionString.Normalize(neonUrl);
        var parsed = new NpgsqlConnectionStringBuilder(normalized);

        Assert.Equal("ep-example-pooler.eu-central-1.aws.neon.tech", parsed.Host);
        Assert.Equal(5432, parsed.Port);
        Assert.Equal("neondb", parsed.Database);
        Assert.Equal("neondb_owner", parsed.Username);
        Assert.Equal("p@ssword", parsed.Password);
        Assert.Equal("Require", parsed["SSL Mode"].ToString());
        Assert.Equal("Require", parsed["Channel Binding"].ToString());
    }

    [Fact]
    public void Normalize_NpgsqlFormat_RemainsValid()
    {
        const string npgsqlConnectionString =
            "Host=localhost;Port=5432;Database=labsistem;Username=labsistem;Password=labsistem";

        var normalized = DatabaseConnectionString.Normalize(npgsqlConnectionString);
        var parsed = new NpgsqlConnectionStringBuilder(normalized);

        Assert.Equal("localhost", parsed.Host);
        Assert.Equal("labsistem", parsed.Database);
    }
}
