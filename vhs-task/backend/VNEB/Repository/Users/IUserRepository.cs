using VNEB.DTO.UserDTO;
using VNEB.Models;
using VNEB.Responses;

namespace VNEB.Repository.Users
{
    public interface IUserRepository
    {
        Task<Response> Login(LoginDTO login);
        Task<Response> Create(NewUserDTO newUser);
        Task<Response> GetById(string id);
        Task<Response> DeleteUser(string userId);
        Task<Response> GetUsersByDepartment(string departmentId);
        Task<Response> ChangePassword(ChangePasswordDTO model);

        Task<Response> GetAllUsers();
        Task<Response> GetAllUsers(bool includeHrDetails);
        Task<Response> UpdateUserInfo(User model); 
        Task<string> UploadContractFile(IFormFile file, string userId, string type);
        Task<string> UploadAvatar(IFormFile file, string userId);
        Task<(byte[] Bytes, string ContentType, string FileName)> DownloadContractFile(string filePath);
    }
}
