using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Restaurant.API.Data;

#nullable disable

namespace Restaurant.API.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260430200000_AddTableRowVersion")]
    public partial class AddTableRowVersion : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Tables",
                type: "rowversion",
                rowVersion: true,
                nullable: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Tables");
        }
    }
}
