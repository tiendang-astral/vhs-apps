using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VNEB.DTO.SpecificationDTO;

using VNEB.Repository.Specifications;

[Route("api/[controller]")]
[ApiController]
[Authorize] // Bắt buộc đăng nhập
public class SpecificationsController : ControllerBase
{
    private readonly ISpecificationRepository _repo;
    public SpecificationsController(ISpecificationRepository repo) => _repo = repo;

    [HttpGet] public async Task<IActionResult> Get() => Ok(await _repo.GetAll());
    [HttpPost] public async Task<IActionResult> Post(SpecificationDTO dto) => Ok(await _repo.Create(dto));
    [HttpPut("{id}")] public async Task<IActionResult> Put(string id, SpecificationDTO dto) => Ok(await _repo.Update(id, dto));
    [HttpDelete("{id}")] public async Task<IActionResult> Delete(string id) => Ok(await _repo.Delete(id));
}