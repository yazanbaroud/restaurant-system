using Microsoft.EntityFrameworkCore;
using Restaurant.API.Models;

namespace Restaurant.API.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<MenuCategoryRecord> MenuCategories => Set<MenuCategoryRecord>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<MenuItemImage> MenuItemImages => Set<MenuItemImage>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusChange> OrderStatusChanges => Set<OrderStatusChange>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<OrderTable> OrderTables => Set<OrderTable>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<RestaurantBusinessHour> BusinessHours => Set<RestaurantBusinessHour>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
            entity.Property(x => x.Role).HasConversion<int>().IsRequired();
            entity.Property(x => x.IsActive).IsRequired().HasDefaultValue(true);
            entity.Property(x => x.TokenVersion).IsRequired();
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
            entity.Property(x => x.ReplacedByTokenHash).HasMaxLength(128);
            entity.Property(x => x.CreatedByIp).HasMaxLength(45);
            entity.Property(x => x.RevokedByIp).HasMaxLength(45);
            entity.Property(x => x.CreatedAtUtc).IsRequired();
            entity.Property(x => x.ExpiresAtUtc).IsRequired();
            entity.HasOne(x => x.User)
                .WithMany(x => x.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Table>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Location).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            if (IsSqlite())
            {
                entity.Property(x => x.RowVersion).IsConcurrencyToken();
            }
            else
            {
                entity.Property(x => x.RowVersion).IsRowVersion();
            }
        });

        modelBuilder.Entity<MenuItem>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Price).HasPrecision(18, 2);
            entity.Property(x => x.Category).IsRequired();
        });

        modelBuilder.Entity<MenuCategoryRecord>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<RestaurantBusinessHour>(entity =>
        {
            entity.ToTable("BusinessHours");
            entity.HasIndex(x => x.DayOfWeek).IsUnique();
            entity.Property(x => x.OpenTime).HasColumnType("time");
            entity.Property(x => x.CloseTime).HasColumnType("time");
        });

        modelBuilder.Entity<MenuItemImage>(entity =>
        {
            entity.Property(x => x.ImageUrl).HasMaxLength(1000).IsRequired();
            entity.HasOne(x => x.MenuItem)
                .WithMany(x => x.Images)
                .HasForeignKey(x => x.MenuItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasIndex(x => x.UniqueIdentifier).IsUnique();
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.Property(x => x.OrderNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CustomerFirstName).HasMaxLength(100);
            entity.Property(x => x.CustomerLastName).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.KitchenStatus).HasConversion<int>().IsRequired();
            entity.Property(x => x.OrderType).HasConversion<int>().IsRequired();
            entity.Property(x => x.PaymentStatus).HasConversion<int>().IsRequired();
            if (IsSqlite())
            {
                entity.Property(x => x.RowVersion).IsConcurrencyToken();
            }
            else
            {
                entity.Property(x => x.RowVersion).IsRowVersion();
            }
            entity.HasOne(x => x.User)
                .WithMany(x => x.Orders)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.HasOne(x => x.Order)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.MenuItem)
                .WithMany(x => x.OrderItems)
                .HasForeignKey(x => x.MenuItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasIndex(x => x.IdempotencyKey).IsUnique();
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.IdempotencyKey).IsRequired();
            entity.Property(x => x.Method).HasConversion<int>().IsRequired();
            entity.Property(x => x.CreatedAt).IsRequired();
            if (IsSqlite())
            {
                entity.Property(x => x.RowVersion).IsConcurrencyToken();
            }
            else
            {
                entity.Property(x => x.RowVersion).IsRowVersion();
            }
            entity.HasOne(x => x.Order)
                .WithMany(x => x.Payments)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderTable>(entity =>
        {
            entity.HasIndex(x => new { x.OrderId, x.TableId }).IsUnique();
            entity.HasOne(x => x.Order)
                .WithMany(x => x.OrderTables)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Table)
                .WithMany(x => x.OrderTables)
                .HasForeignKey(x => x.TableId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Reservation>(entity =>
        {
            entity.HasIndex(x => x.UserId);
            entity.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.PhoneNumber).HasMaxLength(40).IsRequired();
            entity.Property(x => x.CustomerNotes).HasMaxLength(1000);
            entity.Property(x => x.RestaurantNotes).HasMaxLength(1000);
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.HasOne(x => x.User)
                .WithMany(x => x.Reservations)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<OrderStatusChange>(entity =>
        {
            entity.Property(x => x.ChangeType).HasConversion<int>().IsRequired();
            entity.Property(x => x.FromValue).HasMaxLength(40);
            entity.Property(x => x.ToValue).HasMaxLength(40).IsRequired();
            entity.Property(x => x.ChangedAt).IsRequired();
            entity.HasIndex(x => new { x.OrderId, x.ChangedAt });
            entity.HasOne(x => x.Order)
                .WithMany(x => x.StatusChanges)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ChangedByUser)
                .WithMany()
                .HasForeignKey(x => x.ChangedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private bool IsSqlite() =>
        string.Equals(Database.ProviderName, "Microsoft.EntityFrameworkCore.Sqlite", StringComparison.Ordinal);
}
