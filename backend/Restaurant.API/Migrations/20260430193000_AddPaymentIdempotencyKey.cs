using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Restaurant.API.Data;

#nullable disable

namespace Restaurant.API.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260430193000_AddPaymentIdempotencyKey")]
    public partial class AddPaymentIdempotencyKey : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IdempotencyKey",
                table: "Payments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE [Payments]
                SET [IdempotencyKey] = NEWID()
                WHERE [IdempotencyKey] IS NULL;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "IdempotencyKey",
                table: "Payments",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_IdempotencyKey",
                table: "Payments",
                column: "IdempotencyKey",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_IdempotencyKey",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "Payments");
        }
    }
}
