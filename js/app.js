const { Amplify, Auth } = window;

Amplify.configure({
  Auth: {
    region: "us-east-1",
    userPoolId: "us-east-1_9jBRbvy4K",
    userPoolWebClientId: "4mq5eoi1jdrmm1k71ag4fo3gij",
  },
});

async function register() {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await Auth.signUp({
      username,
      password,
      attributes: { email },
    });
    alert("registered. check email then login.");
  } catch (err) {
    alert(err.message);
  }
}

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    await Auth.signIn(username, password);
    alert("logged in");
    checkAuth();
  } catch (err) {
    alert(err.message);
  }
}

async function logout() {
  await Auth.signOut();
  checkAuth();
}

async function checkAuth() {
  const reportCard = document.getElementById("reportCard");
  const logoutBtn = document.getElementById("logoutBtn");

  try {
    await Auth.currentAuthenticatedUser();
    reportCard.style.display = "block";
    logoutBtn.classList.remove("d-none");
  } catch {
    reportCard.style.display = "none";
    logoutBtn.classList.add("d-none");
  }
}

const backendUrl = "http://34.227.53.47:3000";

const reportForm = document.getElementById("reportForm");
const categoryFilter = document.getElementById("categoryFilter");

reportForm.addEventListener("submit", async (e) => {
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
    } else alert("Error submitting issue");
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
});

async function loadIssues() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    const issues = await res.json();

    const selectedCategory = categoryFilter.value;
    const filteredIssues = selectedCategory
      ? issues.filter((issue) => issue.category === selectedCategory)
      : issues;

    const container = document.getElementById("issues");
    container.innerHTML = "";

    filteredIssues.forEach((issue) => {
      const card = document.createElement("div");
      card.className = "col-md-6 col-lg-4";
      card.innerHTML = `
        <div class="card shadow-sm">
          <img src="${issue.imageUrl}" class="card-img-top">
          <div class="card-body">
            <h5 class="card-title text-capitalize">${issue.category}</h5>
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

// load issues on page load
loadIssues();
checkAuth();

// reload when filter changes
categoryFilter.addEventListener("change", loadIssues);
