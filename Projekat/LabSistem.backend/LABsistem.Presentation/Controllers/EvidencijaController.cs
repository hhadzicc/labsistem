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
    public class EvidencijaController : ControllerBase
    {
        private readonly IEvidencijaService _service;
        private readonly IDemoAccessGuard _demoAccessGuard;

        public EvidencijaController(IEvidencijaService service, IDemoAccessGuard demoAccessGuard)
        {
            _service = service;
            _demoAccessGuard = demoAccessGuard;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Get()
        {
            var records = (await _service.VratiSveEvidencije()).ToList();
            if (!IsDemoUser()) return Ok(records);

            var allowedIds = await _demoAccessGuard.GetDemoEvidenceIdsAsync(records.Select(item => item.ID));
            return Ok(records.Where(item => allowedIds.Contains(item.ID)));
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Profesor,Tehnicar")]
        public async Task<IActionResult> Post([FromBody] EvidencijaCreateDTO dto)
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out var parsedUserId))
                {
                    return Unauthorized();
                }

                if (IsDemoUser() &&
                    (!await _demoAccessGuard.IsDemoEquipmentAsync(dto.OpremaID) ||
                     (dto.TerminID.HasValue && !await _demoAccessGuard.IsDemoTermAsync(dto.TerminID.Value))))
                {
                    return Forbid();
                }

                if (IsDemoUser()) dto.KorisnikID = parsedUserId;

                await _service.KreirajEvidenciju(dto, parsedUserId);
                return Ok(new { message = "Kvar uspjesno prijavljen" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Put(int id, [FromBody] EvidencijaUpdateDTO dto)
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out var parsedUserId))
                {
                    return Unauthorized();
                }

                if (IsDemoUser() && !await _demoAccessGuard.IsDemoEvidenceAsync(id)) return Forbid();

                await _service.AzurirajStatus(id, dto, parsedUserId);
                return Ok(new { message = "Status azuriran" });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Delete(int id)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoEvidenceAsync(id)) return Forbid();

            await _service.ObrisiEvidenciju(id);
            return Ok(new { message = "Evidencija obrisana" });
        }

        private bool IsDemoUser() =>
            DemoAccounts.IsDemoUsername(User.FindFirstValue(ClaimTypes.Name));
    }
}
