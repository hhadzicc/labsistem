using System.IO;
using LABsistem.Api.Services;
using LABsistem.Application.DTOs;
using LABsistem.Presentation.Requests;
using LABsistem.Presentation.Services;
using LABsistem.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LABsistem.Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OpremaController : ControllerBase
    {
        private readonly IOpremaService _service;
        private readonly IDemoAccessGuard _demoAccessGuard;

        public OpremaController(IOpremaService service, IDemoAccessGuard demoAccessGuard)
        {
            _service = service;
            _demoAccessGuard = demoAccessGuard;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Profesor,Tehnicar")]
        public async Task<IActionResult> Get([FromQuery] string prikaz = "aktivna")
        {
            var equipment = (await _service.VratiSvuOpremu(prikaz)).ToList();
            if (!IsDemoUser()) return Ok(equipment);

            var allowedIds = await _demoAccessGuard.GetDemoEquipmentIdsAsync(equipment.Select(item => item.ID));
            return Ok(equipment.Where(item => allowedIds.Contains(item.ID)));
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Post([FromForm] OpremaUpsertRequest request)
        {
            if (IsDemoUser())
            {
                if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
                if (!await _demoAccessGuard.IsDemoCabinetAsync(request.KabinetID)) return Forbid();
                request.KreatorID = userId;
            }

            var dto = MapToCreateDto(request);
            var upload = BuildDokumentacijaUpload(request.DokumentacijaFile);
            var created = await _service.KreirajOpremu(dto, upload);
            return Ok(created);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Put(int id, [FromForm] OpremaUpsertRequest request)
        {
            if (IsDemoUser())
            {
                if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
                if (!await _demoAccessGuard.IsDemoEquipmentAsync(id) ||
                    !await _demoAccessGuard.IsDemoCabinetAsync(request.KabinetID)) return Forbid();
                request.KreatorID = userId;
            }

            var dto = MapToCreateDto(request);
            var upload = BuildDokumentacijaUpload(request.DokumentacijaFile);
            await _service.AzurirajOpremu(id, dto, upload);
            return Ok(new { message = "Oprema azurirana." });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Delete(int id)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoEquipmentAsync(id)) return Forbid();

            var uspjeh = await _service.ArhivirajOpremu(id);
            if (!uspjeh) return NotFound();
            return Ok(new { message = "Oprema arhivirana." });
        }

        [HttpPost("{id}/restore")]
        [Authorize(Roles = "Admin,Tehnicar")]
        public async Task<IActionResult> Restore(int id)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoEquipmentAsync(id)) return Forbid();

            var uspjeh = await _service.VratiIzArhive(id);
            if (!uspjeh) return NotFound();
            return Ok(new { message = "Oprema vraćena iz arhive." });
        }

        [HttpGet("kabinet/{kabinetId}")]
        [Authorize]
        public async Task<IActionResult> GetPoKabinetu(int kabinetId)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoCabinetAsync(kabinetId)) return Forbid();

            var oprema = await _service.VratiOpremuPoKabinetu(kabinetId);
            return Ok(oprema);
        }

        [HttpGet("{id}/documentation/file")]
        [Authorize]
        public async Task<IActionResult> GetDocumentationFile(int id)
        {
            if (IsDemoUser() && !await _demoAccessGuard.IsDemoEquipmentAsync(id)) return Forbid();

            var dokumentacija = await _service.VratiDokumentacijuFajlAsync(id);
            if (dokumentacija == null || !System.IO.File.Exists(dokumentacija.FilePath))
            {
                return NotFound();
            }

            return PhysicalFile(dokumentacija.FilePath, "application/pdf", dokumentacija.FileName, enableRangeProcessing: true);
        }

        private static OpremaCreateDTO MapToCreateDto(OpremaUpsertRequest request)
        {
            return new OpremaCreateDTO
            {
                Naziv = request.Naziv,
                Kategorija = request.Kategorija,
                SerijskiBroj = request.SerijskiBroj,
                Stanje = request.Stanje,
                KabinetID = request.KabinetID,
                KreatorID = request.KreatorID,
                DokumentacijaUrl = request.DokumentacijaUrl
            };
        }

        private bool IsDemoUser() =>
            DemoAccounts.IsDemoUsername(User.FindFirstValue(ClaimTypes.Name));

        private bool TryGetCurrentUserId(out int userId) =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

        private static OpremaDokumentacijaUpload? BuildDokumentacijaUpload(IFormFile? file)
        {
            if (file == null)
            {
                return null;
            }

            return new OpremaDokumentacijaUpload(
                file.FileName,
                file.ContentType ?? string.Empty,
                file.OpenReadStream,
                file.Length);
        }
    }
}
