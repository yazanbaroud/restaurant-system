using Microsoft.EntityFrameworkCore;
using Restaurant.API.Data;
using Restaurant.API.DTOs;
using Restaurant.API.Helpers;
using Restaurant.API.Interfaces;

namespace Restaurant.API.Services;

public sealed class UsersService(AppDbContext db) : IUsersService
{
    public async Task<IReadOnlyCollection<UserResponseDto>> GetAllAsync(CancellationToken cancellationToken) =>
        await db.Users.AsNoTracking()
            .OrderBy(x => x.Role)
            .ThenBy(x => x.LastName)
            .Select(x => x.ToUserResponse())
            .ToArrayAsync(cancellationToken);

    public async Task<UserResponseDto> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new ApiException("User not found.", StatusCodes.Status404NotFound);
        return user.ToUserResponse();
    }
}
