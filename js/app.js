const { Amplify, Auth } = window;

Amplify.configure({
  Auth: {
    region: "us-east-1",
    userPoolId: "us-east-1_9jBRbvy4K",
    userPoolWebClientId: "4mq5eoi1jdrmm1k71ag4fo3gij",
  },
});

const backendUrl = "http://34.227.53.47:3000";

// --- AUTH FUNCTIONS ---
async function register() {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await Auth.signUp({ username, password, attributes: { email } });
    alert("Registration successful! Check email for code.");
  } catch (err) {
    alert(err.message);
  }
}

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  try {
    await Auth.signIn(username, password);
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

// --- API FUNCTIONS ---
const reportForm = document.getElementById("reportForm");

reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    // 1. Get the JWT Token from Cognito
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();

    // 2. Build Request
    const formData = new FormData(e.target);
    const res = await fetch(`${backendUrl}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }, // SECURE
      body: formData,
    });

    if (res.ok) {
      alert("Issue reported!");
      e.target.reset();
      loadIssues();
    } else {
      alert("Unauthorized or Server Error");
    }
  } catch (err) {
    alert("Please log in to submit a report.");
  }
});

async function loadIssues() {
  const res = await fetch(`${backendUrl}/api/issues`);
  const issues = await res.json();
  const container = document.getElementById("issues");
  container.innerHTML = issues
    .map(
      (issue) => `
        <div class="col-md-4">
            <div class="card mb-3">
                <img src="${issue.imageUrl}" class="card-img-top">
                <div class="card-body">
                    <h6>${issue.category}</h6>
                    <p>${issue.description}</p>
                </div>
            </div>
        </div>
    `
    )
    .join("");
}

// Init
checkAuth();
loadIssues();
