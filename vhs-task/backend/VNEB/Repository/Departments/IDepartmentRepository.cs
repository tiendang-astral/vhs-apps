using VNEB.Responses;

namespace VNEB.Repository.Departments
{
    public interface IDepartmentRepository
    {
        Task<Response> GetAll();
    }
}
