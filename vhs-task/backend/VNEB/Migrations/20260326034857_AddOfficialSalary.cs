using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VNEB.Migrations
{
    /// <inheritdoc />
    public partial class AddOfficialSalary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OfficialSalary",
                table: "Users",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: "admin-fixed-id-001",
                column: "OfficialSalary",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OfficialSalary",
                table: "Users");
        }
    }
}
