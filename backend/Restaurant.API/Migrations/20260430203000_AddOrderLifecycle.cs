using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Restaurant.API.Data;

#nullable disable

namespace Restaurant.API.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260430203000_AddOrderLifecycle")]
    public partial class AddOrderLifecycle : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "KitchenStatus",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "OrderStatusChangedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OrderStatusChangedByUserId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "KitchenStatusChangedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "KitchenStatusChangedByUserId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentStatusChangedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PaymentStatusChangedByUserId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE [Orders]
                SET [KitchenStatus] = CASE [Status]
                    WHEN 1 THEN 1
                    WHEN 2 THEN 2
                    WHEN 3 THEN 4
                    ELSE 1
                END;

                UPDATE [Orders]
                SET [Status] = CASE [Status]
                    WHEN 2 THEN 1
                    ELSE [Status]
                END;
                """);

            migrationBuilder.CreateTable(
                name: "OrderStatusChanges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<int>(type: "int", nullable: false),
                    ChangeType = table.Column<int>(type: "int", nullable: false),
                    FromValue = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    ToValue = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ChangedByUserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderStatusChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderStatusChanges_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrderStatusChanges_Users_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusChanges_ChangedByUserId",
                table: "OrderStatusChanges",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusChanges_OrderId_ChangedAt",
                table: "OrderStatusChanges",
                columns: new[] { "OrderId", "ChangedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderStatusChanges");

            migrationBuilder.DropColumn(
                name: "KitchenStatus",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OrderStatusChangedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OrderStatusChangedByUserId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "KitchenStatusChangedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "KitchenStatusChangedByUserId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentStatusChangedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaymentStatusChangedByUserId",
                table: "Orders");
        }
    }
}
