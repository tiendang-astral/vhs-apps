using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VNEB.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Province = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IndustrialZone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContractSigningDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ContractExpiryDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TaxCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BankAccountNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UsageLocation = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConnectionPoint = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UsagePurpose = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    VoltageLevel = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MaxPower = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AvgDailyPower = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MinPower = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RegisteredVolume = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LegalDocuments = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Departments_Departments_ParentId",
                        column: x => x.ParentId,
                        principalTable: "Departments",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "EquipmentTransactions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TransactionDate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AssetCode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UniqueAssetId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EquipmentName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    FromWarehouse = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ToWarehouse = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExportedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReceivedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DocumentRef = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentTransactions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Specifications",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    AssetCode = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Group = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Phase = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    VoltageLevel = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Manufacturer = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Model = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SerialNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TotalQuantity = table.Column<int>(type: "int", nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Lifespan = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Specifications", x => x.Id);
                    table.UniqueConstraint("AK_Specifications_AssetCode", x => x.AssetCode);
                });

            migrationBuilder.CreateTable(
                name: "ElectricityUsages",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CustomerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Month = table.Column<int>(type: "int", nullable: false),
                    Price_FlatRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Price_Normal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Price_Peak = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Price_OffPeak = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    P_FlatRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    P_Normal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    P_Peak = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    P_OffPeak = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalConsumption = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Amount_FlatRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Amount_Normal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Amount_Peak = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Amount_OffPeak = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalBillAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElectricityUsages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ElectricityUsages_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Username = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Company = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RefreshToken = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RefreshTokenExpiryTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DepartmentId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryStocks",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    AssetCode = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UniqueAssetId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EquipmentName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WarehouseName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CurrentStock = table.Column<int>(type: "int", nullable: false),
                    Condition = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MinStockLevel = table.Column<int>(type: "int", nullable: false),
                    WarningStatus = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastUpdatedAt = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InventoryStocks_Specifications_AssetCode",
                        column: x => x.AssetCode,
                        principalTable: "Specifications",
                        principalColumn: "AssetCode",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OperatingEquipments",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    AssetCode = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UniqueAssetId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    WiringDiagram = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EquipmentType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Phase = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Voltage = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastInspectionDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NextInspectionDate = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    InspectionCycleMonths = table.Column<int>(type: "int", nullable: false),
                    Manager = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OperatingEquipments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OperatingEquipments_Specifications_AssetCode",
                        column: x => x.AssetCode,
                        principalTable: "Specifications",
                        principalColumn: "AssetCode",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskRegistrations",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Month = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskRegistrations_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskSections",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    RegistrationId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SectionName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonalWeight = table.Column<int>(type: "int", nullable: false),
                    ManagerWeight = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskSections_TaskRegistrations_RegistrationId",
                        column: x => x.RegistrationId,
                        principalTable: "TaskRegistrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskItems",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    SectionId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TaskDescription = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StartDate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EndDate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonalTarget = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonalResult = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonalPriority = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PersonalComplexity = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ManagerTarget = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ManagerResult = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ManagerPriority = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ManagerComplexity = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TaskRegistrationId = table.Column<string>(type: "nvarchar(450)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskItems_TaskRegistrations_TaskRegistrationId",
                        column: x => x.TaskRegistrationId,
                        principalTable: "TaskRegistrations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TaskItems_TaskSections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "TaskSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Departments",
                columns: new[] { "Id", "Name", "ParentId" },
                values: new object[] { 1, "Administration", null });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "Company", "DepartmentId", "Email", "FullName", "PasswordHash", "RefreshToken", "RefreshTokenExpiryTime", "Role", "Username" },
                values: new object[] { "admin-fixed-id-001", "VNEB", 1, "admin@vneb.com.vn", "System Administrator", "m9L+AjyM5YUDAIiNsdLJn+wn8BxzUWhbNaKAXuarawo=", null, null, "ADMIN", "admin" });

            migrationBuilder.CreateIndex(
                name: "IX_Departments_ParentId",
                table: "Departments",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_ElectricityUsages_CustomerId",
                table: "ElectricityUsages",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryStocks_AssetCode",
                table: "InventoryStocks",
                column: "AssetCode");

            migrationBuilder.CreateIndex(
                name: "IX_OperatingEquipments_AssetCode",
                table: "OperatingEquipments",
                column: "AssetCode");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_SectionId",
                table: "TaskItems",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_TaskRegistrationId",
                table: "TaskItems",
                column: "TaskRegistrationId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskRegistrations_UserId",
                table: "TaskRegistrations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskSections_RegistrationId",
                table: "TaskSections",
                column: "RegistrationId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_DepartmentId",
                table: "Users",
                column: "DepartmentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ElectricityUsages");

            migrationBuilder.DropTable(
                name: "EquipmentTransactions");

            migrationBuilder.DropTable(
                name: "InventoryStocks");

            migrationBuilder.DropTable(
                name: "OperatingEquipments");

            migrationBuilder.DropTable(
                name: "TaskItems");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "Specifications");

            migrationBuilder.DropTable(
                name: "TaskSections");

            migrationBuilder.DropTable(
                name: "TaskRegistrations");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Departments");
        }
    }
}
