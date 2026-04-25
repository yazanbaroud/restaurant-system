using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Restaurant.API.Data;

#nullable disable

namespace Restaurant.API.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260425183000_MenuCategoriesAndAccountSecurity")]
    public partial class MenuCategoriesAndAccountSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MenuCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MenuCategories", x => x.Id);
                });

            migrationBuilder.Sql(
                """
                SET IDENTITY_INSERT [MenuCategories] ON;

                INSERT INTO [MenuCategories] ([Id], [Name], [IsActive], [SortOrder])
                VALUES
                    (1, N'סלטים', CAST(1 AS bit), 10),
                    (2, N'עיקריות', CAST(1 AS bit), 20),
                    (3, N'דגים', CAST(1 AS bit), 30),
                    (4, N'בשרים', CAST(1 AS bit), 40),
                    (5, N'קינוחים', CAST(1 AS bit), 50),
                    (6, N'שתייה', CAST(1 AS bit), 60);

                SET IDENTITY_INSERT [MenuCategories] OFF;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_MenuCategories_Name",
                table: "MenuCategories",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MenuCategories");
        }
    }
}
