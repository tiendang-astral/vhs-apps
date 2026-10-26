using VNEB.DTO.SpecificationDTO;
using VNEB.Responses;

namespace VNEB.Repository.Specifications
{
    public interface ISpecificationRepository
    {
        Task<Response> GetAll();
        Task<Response> Create(SpecificationDTO dto);
        Task<Response> Update(string id, SpecificationDTO dto);
        Task<Response> Delete(string id);
    }
}
