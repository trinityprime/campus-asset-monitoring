const form = document.getElementById("issueForm");
const issuesDiv = document.getElementById("issues");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    location: document.getElementById("location").value,
    description: document.getElementById("description").value,
  };

  await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  loadIssues();
});

async function loadIssues() {
  const res = await fetch("/api/issues");
  const data = await res.json();

  issuesDiv.innerHTML = data
    .map((i) => `<p><b>${i.location}</b>: ${i.description}</p>`)
    .join("");
}

loadIssues();
