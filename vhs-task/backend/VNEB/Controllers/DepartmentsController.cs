using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VNEB.Repository.Departments;

namespace VNEB.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bắt buộc đăng nhập
    public class DepartmentsController : ControllerBase
    {
        private readonly IDepartmentRepository _deptRepo;

        public DepartmentsController(IDepartmentRepository deptRepo)
        {
            _deptRepo = deptRepo;
        }

        [HttpGet]
        public async Task<IActionResult> GetDepartments()
        {
            var res = await _deptRepo.GetAll();
            return Ok(res);
        }
    }
}