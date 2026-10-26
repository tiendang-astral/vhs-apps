using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Reflection.Emit;
using System.Security.Cryptography;
using System.Text;

namespace VNEB.Models
{
    public class VnebContext : DbContext
    {
            public VnebContext(DbContextOptions<VnebContext> options) : base(options) { }

            public DbSet<User> Users { get; set; }
            public DbSet<Department> Departments { get; set; }
            public DbSet<Specification> Specifications { get; set; }
            public DbSet<OperatingEquipment> OperatingEquipments { get; set; }
            public DbSet<InventoryStock> InventoryStocks { get; set; }
            public DbSet<EquipmentTransaction> EquipmentTransactions { get; set; }
            public DbSet<Customer> Customers { get; set; }
            public DbSet<ElectricityUsage> ElectricityUsages { get; set; }
            public DbSet<TaskRegistration> TaskRegistrations { get; set; }
            public DbSet<TaskItem> TaskItems { get; set; }
            public DbSet<TaskSection> TaskSections { get; set; }
            public DbSet<LeaveRequest> LeaveRequests { get; set; }
            public DbSet<UserLeaveQuota>UserLeaveQuotas{ get; set; }
            public DbSet<Notification>Notifications{ get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            // Chỉ đọc appsettings.json khi context KHÔNG được tạo qua DI (vd: chạy lệnh dotnet ef).
            // Trước đây file cấu hình bị đọc lại từ ổ đĩa ở mỗi request.
            if (!optionsBuilder.IsConfigured)
            {
                IConfigurationRoot conf = new ConfigurationBuilder()
                    .SetBasePath(Directory.GetCurrentDirectory())
                    .AddJsonFile("appsettings.json")
                    .AddJsonFile("appsettings.Local.json", optional: true)
                    .AddEnvironmentVariables()
                    .Build();
                optionsBuilder.UseSqlServer(conf.GetConnectionString("SEP490_G49"));
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // --- 1. Cấu hình Quan hệ (Mã khách hàng làm Id, AssetCode làm Business Key) ---
            modelBuilder.Entity<ElectricityUsage>()
                .HasOne(e => e.Customer)
                .WithMany(c => c.ElectricityUsages)
                .HasForeignKey(e => e.CustomerId);

            modelBuilder.Entity<InventoryStock>()
                .HasOne(i => i.Specification)
                .WithMany(s => s.Stocks)
                .HasPrincipalKey(s => s.AssetCode)
                .HasForeignKey(i => i.AssetCode);

            modelBuilder.Entity<OperatingEquipment>()
                .HasOne(o => o.Specification)
                .WithMany(s => s.OperatingEquipments)
                .HasPrincipalKey(s => s.AssetCode)
                .HasForeignKey(o => o.AssetCode);

            // --- 2. Seed Data (Tạo dữ liệu mặc định) ---

            // Tạo phòng ban mẫu
            modelBuilder.Entity<Department>().HasData(
                new Department { Id = 1, Name = "Administration" }
            );
            string adminPasswordHash = SeedHashPassword("Vhscorp@123");

            modelBuilder.Entity<User>().HasData(
                new User
                {
                    Id = "admin-fixed-id-001",
                    Username = "admin",
                    PasswordHash = adminPasswordHash, 
                    FullName = "System Administrator",
                    Email = "admin@vneb.com.vn",
                    Role = "ADMIN",
                    Company = "VNEB",
                    DepartmentId = 1
                }
            );

            // --- 3. Cấu hình định dạng Decimal ---
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                .SelectMany(t => t.GetProperties())
                .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            {
                property.SetColumnType("decimal(18,2)");
            }
        }
        private string SeedHashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
            return Convert.ToBase64String(bytes);
        }
    }
    }

