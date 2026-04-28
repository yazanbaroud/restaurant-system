using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Restaurant.API.Data;

#nullable disable

namespace Restaurant.API.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260429010000_AddBusinessHours")]
    public partial class AddBusinessHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BusinessHours",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DayOfWeek = table.Column<int>(type: "int", nullable: false),
                    IsOpen = table.Column<bool>(type: "bit", nullable: false),
                    OpenTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    CloseTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessHours", x => x.Id);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO [BusinessHours] ([DayOfWeek], [IsOpen], [OpenTime], [CloseTime], [CreatedAt], [UpdatedAt])
                VALUES
                    (0, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME()),
                    (1, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME()),
                    (2, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME()),
                    (3, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME()),
                    (4, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME()),
                    (5, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME()),
                    (6, CAST(1 AS bit), CAST('10:00:00' AS time), CAST('23:00:00' AS time), SYSUTCDATETIME(), SYSUTCDATETIME());
                """);

            migrationBuilder.CreateIndex(
                name: "IX_BusinessHours_DayOfWeek",
                table: "BusinessHours",
                column: "DayOfWeek",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BusinessHours");
        }
    }
}
