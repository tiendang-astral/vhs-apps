using Microsoft.EntityFrameworkCore;
using VNEB.Models;
using VNEB.Responses;

namespace VNEB.Repository.Departments
{
    public class DepartmentRepository : IDepartmentRepository
    {
        private readonly VnebContext _context;

        public DepartmentRepository(VnebContext context)
        {
            _context = context;
        }

        public async Task<Response> GetAll()
        {
            try
            {
                var departments = await _context.Departments
                    .Select(d => new { d.Id, d.Name })
                    .ToListAsync();

                return new Response
                {
                    Code = 200,
                    Data = departments,
                    Message = "Success"
                };
            }
            catch (Exception ex)
            {
                return new Response { Code = 500, Message = ex.Message };
            }
        }
    }
}
