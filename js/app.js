const backendUrl = "http://34.227.53.47:3000";

// handle form submit
document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  try {
    const res = await fetch(`${backendUrl}/report`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      alert("Issue reported!");
      e.target.reset();
      loadIssues();
    } else {
      alert("Error submitting issue");
    }
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
});

// fetch & render issues
async function loadIssues() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    const issues = await res.json();
    const container = document.getElementById("issues");
    container.innerHTML = ""; 

    issues.forEach((issue) => {
      const card = document.createElement("div");
      card.className = "col-md-4 mb-3";
      card.innerHTML = `
        <div class="card">
          <img src="${issue.imageUrl}" class="card-img-top" style="height:200px; object-fit:cover;">
          <div class="card-body">
            <h5 class="card-title">${issue.category}</h5>
            <p class="card-text">${issue.description}</p>
            <small class="text-muted">${issue.location} | ${issue.status}</small>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

loadIssues();
