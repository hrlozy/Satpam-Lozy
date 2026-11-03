/**
 * ==============================================================================
 * API CONFIGURATION & ADAPTER — GITHUB PAGES TO GOOGLE APPS SCRIPT
 * ==============================================================================
 * File ini menjembatani frontend di GitHub Pages dengan backend Google Apps Script.
 * Memungkinkan pemanggilan `google.script.run` tetap bekerja 100% tanpa perubahan!
 */

// URL Deployment Web App Google Apps Script Anda (Ganti dengan URL /exec Anda)
// Contoh: "https://script.google.com/macros/s/AKfycbx.../exec"
var DEFAULT_GAS_API_URL = "";

// Ambil URL dari localStorage jika user pernah menginputkan via UI
var GAS_API_URL = localStorage.getItem('satpam_gas_api_url') || DEFAULT_GAS_API_URL;

// Helper Navigasi Halaman di GitHub Pages
function getAppPageUrl(pageName) {
  var p = (pageName || '').toLowerCase();
  if (p === 'login' || p === 'index.html') return 'index.html';
  if (p === 'index' || p === 'app' || p === 'app.html') return 'app.html';
  if (p === 'admin' || p === 'admin.html') return 'admin.html';
  if (p === 'printqr' || p === 'print-qr.html') return 'print-qr.html';
  if (p === 'scanner' || p === 'scanner.html') return 'scanner.html';
  return pageName;
}

// Buka dialog untuk mengubah URL Google Apps Script
function configureGasApiUrl() {
  var currentUrl = localStorage.getItem('satpam_gas_api_url') || DEFAULT_GAS_API_URL;
  var newUrl = prompt(
    "PENGATURAN KONEKSI BACKEND GOOGLE APPS SCRIPT:\n\n" +
    "Masukkan Web App URL (akhiran /exec) dari Google Apps Script Anda:",
    currentUrl || "https://script.google.com/macros/s/.../exec"
  );
  if (newUrl && newUrl.trim() && newUrl !== currentUrl) {
    localStorage.setItem('satpam_gas_api_url', newUrl.trim());
    GAS_API_URL = newUrl.trim();
    alert("URL Backend berhasil disimpan! Halaman akan dimuat ulang.");
    window.location.reload();
  }
}

// ==============================================================================
// POLYFILL GOOGLE.SCRIPT.RUN ADAPTER (REST API via fetch)
// ==============================================================================
(function() {
  // Hanya aktifkan polyfill jika berjalan di LUAR Google Apps Script iframe (misal di GitHub Pages / localhost)
  var isGoogleEnv = (typeof window.google !== 'undefined' && window.google.script && window.google.script.run);

  if (!isGoogleEnv) {
    function createRunner(successCallback, failureCallback) {
      return new Proxy({}, {
        get: function(target, actionName) {
          return function() {
            var args = Array.prototype.slice.call(arguments);

            // Cek apakah URL Backend sudah diset
            if (!GAS_API_URL || GAS_API_URL.indexOf('script.google.com') === -1) {
              var promptUrl = prompt(
                "KONEKSI SERVER BELUM DIATUR!\n\n" +
                "Silakan masukkan URL Web App Google Apps Script Anda (akhiran /exec):",
                "https://script.google.com/macros/s/.../exec"
              );
              if (promptUrl && promptUrl.trim()) {
                localStorage.setItem('satpam_gas_api_url', promptUrl.trim());
                GAS_API_URL = promptUrl.trim();
              } else {
                if (failureCallback) failureCallback(new Error("URL Google Apps Script belum diisi."));
                return;
              }
            }

            var payload = {
              action: actionName,
              args: args
            };

            // PENTING: Jangan gunakan headers 'Content-Type': 'application/json'
            // Gunakan body JSON murni agar browser menganggapnya 'Simple Request'
            // dan TIDAK mengirim OPTIONS preflight (mencegah CORS Error pada GAS).
            fetch(GAS_API_URL, {
              method: 'POST',
              body: JSON.stringify(payload)
            })
            .then(function(response) {
              if (!response.ok) {
                throw new Error("HTTP error " + response.status + ": " + response.statusText);
              }
              return response.json();
            })
            .then(function(result) {
              if (successCallback) {
                successCallback(result);
              }
            })
            .catch(function(err) {
              console.error("[GAS Adapter Error] " + actionName + ":", err);
              if (failureCallback) {
                failureCallback(err);
              } else {
                alert("Gagal menghubungi server Google Apps Script: " + err.message);
              }
            });
          };
        }
      });
    }

    // Pasang window.google.script.run
    window.google = {
      script: {
        run: (function() {
          var runner = {
            withSuccessHandler: function(onSuccess) {
              return {
                withFailureHandler: function(onFailure) {
                  return createRunner(onSuccess, onFailure);
                },
                ...createRunner(onSuccess, null)
              };
            },
            withFailureHandler: function(onFailure) {
              return {
                withSuccessHandler: function(onSuccess) {
                  return createRunner(onSuccess, onFailure);
                },
                ...createRunner(null, onFailure)
              };
            },
            ...createRunner(null, null)
          };
          return runner;
        })()
      }
    };

    console.log("GitHub Pages API Adapter Active -> Connected to: " + (GAS_API_URL || "Belum diatur"));
  }
})();
