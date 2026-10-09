using System.Reflection;
using LABsistem.Presentation.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;

namespace LABsistem.Tests.Unit;

public class AuthorizationContractTests
{
    [Fact]
    public void ApiActions_DeclareAuthorizationIntent()
    {
        var unsecuredActions = GetApiActions()
            .Where(action => !HasAttribute<AuthorizeAttribute>(action))
            .Where(action => !HasAttribute<AllowAnonymousAttribute>(action))
            .Select(action => $"{action.DeclaringType!.Name}.{action.Name}")
            .OrderBy(name => name)
            .ToArray();

        Assert.True(
            unsecuredActions.Length == 0,
            $"API actions without an authorization contract: {string.Join(", ", unsecuredActions)}");
    }

    [Fact]
    public void AnonymousApiActions_ExistOnlyOnAuthController()
    {
        var unexpectedAnonymousActions = GetApiActions()
            .Where(action => HasAttribute<AllowAnonymousAttribute>(action))
            .Where(action => action.DeclaringType != typeof(AuthController))
            .Select(action => $"{action.DeclaringType!.Name}.{action.Name}")
            .OrderBy(name => name)
            .ToArray();

        Assert.True(
            unexpectedAnonymousActions.Length == 0,
            $"Anonymous API actions outside AuthController: {string.Join(", ", unexpectedAnonymousActions)}");
    }

    private static IEnumerable<MethodInfo> GetApiActions()
    {
        return typeof(AuthController).Assembly
            .GetTypes()
            .Where(type => !type.IsAbstract && typeof(ControllerBase).IsAssignableFrom(type))
            .SelectMany(type => type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            .Where(method => method.GetCustomAttributes<HttpMethodAttribute>(inherit: true).Any());
    }

    private static bool HasAttribute<TAttribute>(MethodInfo action)
        where TAttribute : Attribute
    {
        return action.IsDefined(typeof(TAttribute), inherit: true) ||
               action.DeclaringType!.IsDefined(typeof(TAttribute), inherit: true);
    }
}
