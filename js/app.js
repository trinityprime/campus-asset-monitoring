// --- CONFIGURATION ---
const poolData = {
  UserPoolId: "us-east-1_9jBRbvy4K",
  ClientId: "2ln0cuq94e7ckjo0ira0qqod5u",
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
const backendUrl = "http://campus-issues.duckdns.org:3000";

// Global variable for the Bootstrap Modal
let authModal;

// Initialize Modal when page loads
document.addEventListener("DOMContentLoaded", () => {
  authModal = new bootstrap.Modal(document.getElementById("authModal"));
});

// --- AUTH UI LOGIC ---

// The "Smart" Button logic
function handleReportClick() {
  const cognitoUser = userPool.getCurrentUser();

  if (cognitoUser) {
    // If logged in, ensure we have a valid session, then show form
    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        authModal.show();
      } else {
        const reportCard = document.getElementById("reportCard");
        reportCard.classList.remove("hidden");
        reportCard.scrollIntoView({ behavior: "smooth" });
      }
    });
  } else {
    // Not logged in? Show the popup
    authModal.show();
  }
}

// --- REGISTER & VERIFY ---
function register() {
  const username = document.getElementById("regUsername").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;

  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name: "email",
      Value: email,
    }),
  ];

  userPool.signUp(username, password, attributeList, null, (err, result) => {
    if (err) return alert(err.message);

    document.getElementById("registerSection").classList.add("hidden");
    document.getElementById("verifySection").classList.remove("hidden");
    alert("Code sent to " + email);
  });
}

function confirmRegistration() {
  const username = document.getElementById("regUsername").value;
  const code = document.getElementById("verifyCode").value;

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: username,
    Pool: userPool,
  });

  cognitoUser.confirmRegistration(code, true, (err, result) => {
    if (err) return alert(err.message);
    alert("Verified! You can now sign in.");
    toggleAuth(false); // Switch back to login view inside modal
  });
}

// --- LOGIN ---
function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: username,
    Password: password,
  });

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
    Username: username,
    Pool: userPool,
  });

  cognitoUser.authenticateUser(authDetails, {
    onSuccess: (result) => {
      authModal.hide(); // Close the popup
      checkAuth(); // Refresh UI to show logout btn
      // Automatically open the report form after successful login
      document.getElementById("reportCard").classList.remove("hidden");
    },
    onFailure: (err) => alert(err.message),
  });
}

// --- SESSION CHECK ---
function checkAuth() {
  const cognitoUser = userPool.getCurrentUser();
  const logoutBtn = document.getElementById("logoutBtn");

  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (session && session.isValid()) {
        logoutBtn.classList.remove("hidden");
      } else {
        logoutBtn.classList.add("hidden");
      }
    });
  } else {
    logoutBtn.classList.add("hidden");
  }
}

// --- ISSUES LOGIC (With Filter) ---
async function loadIssues() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    let issues = await res.json();

    const filterValue = document.getElementById("categoryFilter").value;
    if (filterValue) {
      issues = issues.filter(
        (i) => i.category.toLowerCase() === filterValue.toLowerCase()
      );
    }

    const container = document.getElementById("issues");
    if (issues.length === 0) {
      container.innerHTML =
        "<p class='text-center mt-5 text-muted'>No issues reported in this category.</p>";
      return;
    }

    container.innerHTML = issues
      .map(
        (issue) => `
            <div class="col-md-4 mb-4">
                <div class="card h-100 card-shadow border-0">
                    <img src="${
                      issue.imageUrl
                    }" class="card-img-top" alt="Issue">
                    <div class="card-body">
                        <span class="badge bg-soft-primary text-primary mb-2 text-capitalize">${
                          issue.category
                        }</span>
                        <p class="card-text fw-bold mb-1">${
                          issue.description
                        }</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">📍 ${
                              issue.location
                            }</small>
                            <span class="badge rounded-pill bg-light text-dark border">${
                              issue.status || "Received"
                            }</span>
                        </div>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

// --- SUBMIT ---
document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cognitoUser = userPool.getCurrentUser();

  cognitoUser.getSession(async (err, session) => {
    if (err) return authModal.show();

    const token = session.getIdToken().getJwtToken();
    const formData = new FormData(e.target);

    try {
      const res = await fetch(`${backendUrl}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        alert("Thank you! Report submitted.");
        e.target.reset();
        document.getElementById("reportCard").classList.add("hidden");
        loadIssues();
      }
    } catch (err) {
      alert("Connection error.");
    }
  });
});

function logout() {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
  window.location.reload();
}

// Event Listeners & Init
document
  .getElementById("categoryFilter")
  .addEventListener("change", loadIssues);
checkAuth();
loadIssues();
