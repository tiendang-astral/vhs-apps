using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace VNEB.Models
{
    public class User
    {
        [Key]
        public string Id { get; set; }
        public string Username { get; set; } = string.Empty;
        [JsonIgnore] // Không bao giờ trả mật khẩu đã băm ra API
        public string PasswordHash { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; }
        public string Company { get; set; } = string.Empty;

        // --- Thông tin định danh & Liên hệ ---
        public string? Gender { get; set; } 
        public DateTime? Birthday { get; set; } 
        public string? IdCardNumber { get; set; }
        public DateTime? IdCardIssuedDate { get; set; }
        public string? IdCardIssuedPlace { get; set; }
        public string? PermanentAddress { get; set; }
        public string? Ethnic { get; set; }
        public string? PhoneNumber { get; set; }
        public string? AvatarPath { get; set; }

        // --- Trình độ & Chuyên môn ---
        public string? EducationLevel { get; set; }
        public string? School { get; set; }
        public string? Major { get; set; }

        // --- Thông tin công việc ---
        public string? Position { get; set; }
        public DateTime? JoinDate { get; set; }
        public DateTime? ProbationStartDate { get; set; } // Thử việc từ ngày
        public DateTime? ProbationEndDate { get; set; } // Thử việc đến ngày

        // --- Quản lý Hợp đồng (Dạng File Path) ---
        public string? ContractType { get; set; } // Loại hợp đồng
        public string? OfficialContractFile1 { get; set; } // File HĐ chính thức lần 1 (Path)
        public string? OfficialContractFile2 { get; set; } // File HĐ chính thức lần 2 (Path)
        public string? OfficialContractFile3 { get; set; } // File HĐ chính thức lần 3 (Path)
        
        // --- Ngày ký HĐ (Dùng để quản lý thời hạn/gia hạn) ---
        public DateTime? OfficialContractDate1 { get; set; } // Ngày ký HĐ lần 1
        public DateTime? OfficialContractDate2 { get; set; } // Ngày ký HĐ lần 2
        public DateTime? OfficialContractDate3 { get; set; } // Ngày ký HĐ lần 3

        // --- Mã số thuế & Bảo hiểm ---
        public string? TaxCode { get; set; }
        public string? InsuranceCode { get; set; } // Mã số BHXH
        public decimal? InsuranceSalaryStart { get; set; } // Mức lương đóng BHXH khởi điểm
        public decimal? InsuranceSalaryCurrent { get; set; } // Mức lương đóng BHXH hiện tại

        // --- Lương & Ngân hàng ---
        public decimal? ProbationSalary { get; set; } // Mức lương Thử việc
        public decimal? OfficialSalary { get; set; }
        public string? BankAccountNumber { get; set; } // Tài khoản ngân hàng
        public string? BankName { get; set; } // Tên ngân hàng

        // --- JWT Authentication Fields ---
        [JsonIgnore]
        public string? RefreshToken { get; set; }
        [JsonIgnore]
        public DateTime? RefreshTokenExpiryTime { get; set; }

        // --- Relationships ---
        public int DepartmentId { get; set; }
        [ForeignKey("DepartmentId")]
        public virtual Department? Department { get; set; }
    }
}