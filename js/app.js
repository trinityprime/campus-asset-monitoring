const form = document.getElementById("issueForm");
const issuesDiv = document.getElementById("issues");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const location = document.getElementById("location").value.trim();
  const description = document.getElementById("description").value.trim();
  const imageFile = document.getElementById("image").files[0];

  if (!location) return;

  const formData = new FormData();
  formData.append("location", location);
  formData.append("description", description);
  if (imageFile) formData.append("image", imageFile);

  try {
    const res = await fetch("/api/issues", {
      method: "POST",
      body: formData,
    });

    const saved = await res.json();
    renderIssue(saved);
  } catch {
    renderIssue({
      location,
      description,
      imageUrl: imageFile ? URL.createObjectURL(imageFile) : null,
    });
  }

  form.reset();
});

function renderIssue(issue) {
  const col = document.createElement("div");
  col.className = "col-md-4";

  col.innerHTML = `
    <div class="card h-100">
      ${
        issue.imageUrl
          ? `<img src="${issue.imageUrl}" class="card-img-top">`
          : ""
      }
      <div class="card-body">
        <h6 class="card-title">${issue.location}</h6>
        <p class="card-text">${issue.description || ""}</p>
      </div>
    </div>
  `;
  issuesDiv.prepend(col);
}

async function loadIssues() {
  try {
    const res = await fetch("/api/issues");
    const data = await res.json();
    issuesDiv.innerHTML = "";
    data.forEach(renderIssue);
  } catch {
    console.log("backend asleep but frontend still shining");
  }
}

loadIssues();
