using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VNEB.DTO.UserDTO;
using VNEB.Helpers;
using VNEB.Models;
using VNEB.Repository.Users;
using VNEB.Responses;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc đăng nhập
    public class UsersController : ControllerBase
    {
        private readonly IUserRepository _userRepo;
        private readonly IConfiguration _config;

        public UsersController(IUserRepository userRepo, IConfiguration config)
        {
            _userRepo = userRepo;
            _config = config;
        }

        private bool IsHr => User.IsHr(_config);
        private bool IsSelf(string userId) => !string.IsNullOrEmpty(userId) && userId == User.GetUserId();
        private IActionResult NoPermission() =>
            StatusCode(403, new Response { Code = 403, Message = "Bạn không có quyền thực hiện thao tác này." });

        [AllowAnonymous]
        [EnableRateLimiting("login")] // Chống dò mật khẩu: giới hạn số lần thử đăng nhập
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDTO loginDto)
        {
            var result = await _userRepo.Login(loginDto);

            if (result.Code == 200)
                return Ok(result);

            return BadRequest(result);
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] NewUserDTO newUserDto)
        {
            if (!User.IsAdmin()) return NoPermission();
            var res = await _userRepo.Create(newUserDto);
            if (res.Code == 400 || res.Code == 404) return BadRequest(res);
            return Ok(res);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            if (!IsSelf(id) && !IsHr) return NoPermission();
            var result = await _userRepo.GetById(id);

            if (result.Code == 200)
                return Ok(result);

            return NotFound(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            if (!IsHr) return NoPermission();
            if (IsSelf(id)) return BadRequest(new Response { Code = 400, Message = "Không thể tự xóa tài khoản của chính mình." });
            var result = await _userRepo.DeleteUser(id);

            if (result.Code == 200)
                return Ok(result);

            return BadRequest(result);
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAll()
        {
            // Phòng nhân sự / lãnh đạo xem đầy đủ hồ sơ, người khác chỉ xem thông tin cơ bản
            var result = await _userRepo.GetAllUsers(IsHr);
            return Ok(result);
        }

        [HttpPut("update-info")]
        public async Task<IActionResult> UpdateInfo([FromBody] User model)
        {
            if (!IsHr) return NoPermission();
            var result = await _userRepo.UpdateUserInfo(model);
            if (result.Code == 200) return Ok(result);
            return BadRequest(result);
        }

        [HttpPost("upload-contract")]
        public async Task<IActionResult> UploadFile(IFormFile file, [FromQuery] string userId, [FromQuery] string type)
        {
            if (!IsHr) return NoPermission();
            try
            {
                var filePath = await _userRepo.UploadContractFile(file, userId, type);
                return Ok(new Response { Code = 200, Data = filePath, Message = "Upload file thành công." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new Response { Code = 400, Message = ex.Message });
            }
            catch (Exception)
            {
                return BadRequest(new Response { Code = 400, Message = "Upload file thất bại." });
            }
        }

        [HttpPost("upload-avatar/{userId}")]
        public async Task<IActionResult> UploadAvatar(IFormFile file, string userId)
        {
            if (!IsSelf(userId) && !IsHr) return NoPermission();
            try
            {
                var path = await _userRepo.UploadAvatar(file, userId);
                return Ok(new { code = 200, data = path, message = "Tải ảnh lên thành công" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { code = 400, message = ex.Message });
            }
        }

        [HttpGet("download-contract")]
        public async Task<IActionResult> DownloadContract(string filePath)
        {
            if (!IsHr) return NoPermission();
            try
            {
                var fileData = await _userRepo.DownloadContractFile(filePath);
                return File(fileData.Bytes, fileData.ContentType, fileData.FileName);
            }
            catch (FileNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Không tải được file." });
            }
        }

        [HttpGet("department/{departmentId}")]
        public async Task<IActionResult> GetUsersByDepartment(string departmentId)
        {
            var result = await _userRepo.GetUsersByDepartment(departmentId);

            if (result.Code == 200)
                return Ok(result);

            return BadRequest(result);
        }

        [HttpPost("auth/change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDTO model)
        {
            // Chỉ được đổi mật khẩu của chính mình (ADMIN được đổi cho người khác)
            if (!IsSelf(model.UserId) && !User.IsAdmin()) return NoPermission();
            var result = await _userRepo.ChangePassword(model);

            if (result.Code == 200)
                return Ok(result);

            return BadRequest(result);
        }
    }
}
