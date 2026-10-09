using Npgsql;

namespace LABsistem.Presentation.Configuration;

public static class DatabaseConnectionString
{
    public static string Normalize(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("Connection string ne smije biti prazan.", nameof(connectionString));
        }

        var trimmedConnectionString = connectionString.Trim();
        if (!trimmedConnectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !trimmedConnectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return new NpgsqlConnectionStringBuilder(trimmedConnectionString).ConnectionString;
        }

        if (!Uri.TryCreate(trimmedConnectionString, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("PostgreSQL URL nije ispravan.", nameof(connectionString));
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
        if (userInfo.Length != 2 || string.IsNullOrWhiteSpace(uri.Host) || string.IsNullOrWhiteSpace(database))
        {
            throw new ArgumentException("PostgreSQL URL nema sve obavezne podatke.", nameof(connectionString));
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = database,
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = Uri.UnescapeDataString(userInfo[1]),
            Pooling = true
        };

        foreach (var parameter in ParseQuery(uri.Query))
        {
            if (parameter.Key.Equals("sslmode", StringComparison.OrdinalIgnoreCase))
            {
                builder["SSL Mode"] = parameter.Value;
            }
            else if (parameter.Key.Equals("channel_binding", StringComparison.OrdinalIgnoreCase))
            {
                builder["Channel Binding"] = parameter.Value;
            }
        }

        return builder.ConnectionString;
    }

    private static IEnumerable<KeyValuePair<string, string>> ParseQuery(string query)
    {
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2)
            {
                yield return new KeyValuePair<string, string>(
                    Uri.UnescapeDataString(parts[0]),
                    Uri.UnescapeDataString(parts[1]));
            }
        }
    }
}
