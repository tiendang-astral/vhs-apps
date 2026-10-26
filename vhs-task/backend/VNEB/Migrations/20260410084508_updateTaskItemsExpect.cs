using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VNEB.Migrations
{
    /// <inheritdoc />
    public partial class updateTaskItemsExpect : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExpectedOutcome",
                table: "TaskItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpectedOutcome",
                table: "TaskItems");
        }
    }
}
