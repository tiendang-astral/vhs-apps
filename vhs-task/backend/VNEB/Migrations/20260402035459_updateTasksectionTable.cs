using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VNEB.Migrations
{
    /// <inheritdoc />
    public partial class updateTasksectionTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagerWeight",
                table: "TaskSections");

            migrationBuilder.DropColumn(
                name: "PersonalWeight",
                table: "TaskSections");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "LeaveRequests",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "UserLeaveQuotas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    RemainingLastYear = table.Column<double>(type: "float", nullable: false),
                    NewQuota = table.Column<double>(type: "float", nullable: false),
                    UsedPaidLeave = table.Column<double>(type: "float", nullable: false),
                    LateEarlyCount = table.Column<int>(type: "int", nullable: false),
                    UnpaidLeave = table.Column<double>(type: "float", nullable: false),
                    SpecialLeave = table.Column<double>(type: "float", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLeaveQuotas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserLeaveQuotas_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserLeaveQuotas_UserId",
                table: "UserLeaveQuotas",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserLeaveQuotas");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "LeaveRequests");

            migrationBuilder.AddColumn<int>(
                name: "ManagerWeight",
                table: "TaskSections",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PersonalWeight",
                table: "TaskSections",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
