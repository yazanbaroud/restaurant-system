using System.Net;
using System.Text.Json;
using FluentValidation;
using Restaurant.API.Helpers;

namespace Restaurant.API.Middleware;

public sealed class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var statusCode = exception switch
        {
            ValidationException => StatusCodes.Status400BadRequest,
            ApiException apiException => apiException.StatusCode,
            _ => StatusCodes.Status500InternalServerError
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception");
        }
        else
        {
            logger.LogWarning(exception, "Request failed with {StatusCode}", statusCode);
        }

        object response = exception is ValidationException validationException
            ? new
            {
                status = statusCode,
                title = "Validation failed",
                errors = validationException.Errors
                    .GroupBy(x => x.PropertyName)
                    .ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray())
            }
            : new
            {
                status = statusCode,
                title = statusCode == (int)HttpStatusCode.InternalServerError ? "An unexpected error occurred." : exception.Message
            };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }
}
