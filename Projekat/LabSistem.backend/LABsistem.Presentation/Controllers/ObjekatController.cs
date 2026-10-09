using LABsistem.Api.Services;
using LABsistem.Application.DTOs;
using LABsistem.Domain;
using LABsistem.Presentation.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LABsistem.Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ObjekatController : ControllerBase
    {
        private readonly IObjekatService _service;
        private readonly IDemoAccessGuard _demoAccessGuard;

        public ObjekatController(IObjekatService service, IDemoAccessGuard demoAccessGuard)
        {
            _service = service;
            _demoAccessGuard = demoAccessGuard;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Profesor,Tehnicar")]
        public async Task<IActionResult> Get()
        {
            var objects = (await _service.VratiSveObjekte()).ToList();
            if (!IsDemoUser()) return Ok(objects);

            var allowedIds = await _demoAccessGuard.GetDemoObjectIdsAsync(objects.Select(item => item.ID));
            return Ok(objects.Where(item => allowedIds.Contains(item.ID)));
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Post([FromBody] ObjekatCreateDTO dto)
        {
            await _service.KreirajObjekat(dto);
            return Ok(new { message = "Objekat uspjesno dodan" });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Put(int id, [FromBody] ObjekatCreateDTO dto)
        {
            await _service.AzurirajObjekat(id, dto);
            return Ok(new { message = "Objekat azuriran" });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            await _service.ObrisiObjekat(id);
            return Ok(new { message = "Objekat obrisan" });
        }

        private bool IsDemoUser() =>
            DemoAccounts.IsDemoUsername(User.FindFirstValue(ClaimTypes.Name));
    }
}
