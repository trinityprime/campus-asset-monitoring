// Configuration
const poolData = {
  UserPoolId: "us-east-1_9jBRbvy4K",
  ClientId: "2ln0cuq94e7ckjo0ira0qqod5u",
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
const backendUrl = "http://campus-issues.duckdns.org:3000";

// --- REGISTER ---
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

    // Success: Hide register, show verify
    document.getElementById("registerSection").classList.add("hidden");
    document.getElementById("verifySection").classList.remove("hidden");
    alert("Registration successful! Please enter the code sent to " + email);
  });
}

// --- VERIFY CODE ---
function confirmRegistration() {
  const username = document.getElementById("regUsername").value;
  const code = document.getElementById("verifyCode").value;

  const userData = {
    Username: username,
    Pool: userPool,
  };

  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  cognitoUser.confirmRegistration(code, true, (err, result) => {
    if (err) return alert(err.message);

    alert("Account verified! You can now login.");
    // Switch back to login view
    document.getElementById("verifySection").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");
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
      console.log("Logged in successfully");
      checkAuth(); // Refresh UI
    },
    onFailure: (err) => alert(err.message),
  });
}

// --- UI & SESSION MANAGEMENT ---
function checkAuth() {
  const cognitoUser = userPool.getCurrentUser();
  const authCard = document.getElementById("authCard");
  const reportCard = document.getElementById("reportCard");
  const logoutBtn = document.getElementById("logoutBtn");

  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        showLoggedOutState();
      } else {
        // User is logged in
        authCard.classList.add("hidden");
        reportCard.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
      }
    });
  } else {
    showLoggedOutState();
  }
}

function showLoggedOutState() {
  document.getElementById("authCard").classList.remove("hidden");
  document.getElementById("reportCard").classList.add("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
}

// --- SUBMIT REPORT ---
document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cognitoUser = userPool.getCurrentUser();

  if (!cognitoUser) return alert("Please login first");

  cognitoUser.getSession(async (err, session) => {
    if (err) return alert("Session expired. Please login again.");

    const token = session.getIdToken().getJwtToken();
    const formData = new FormData(e.target);

    try {
      const res = await fetch(`${backendUrl}/report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        alert("Reported successfully!");
        e.target.reset();
        loadIssues();
      } else {
        alert("Server error. Please try again.");
      }
    } catch (err) {
      alert("Error connecting to backend.");
    }
  });
});

// --- LOAD ISSUES ---
async function loadIssues() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    let issues = await res.json();

    const filterValue = document.getElementById("categoryFilter").value;

    if (filterValue) {
      issues = issues.filter(
        (issue) => issue.category.toLowerCase() === filterValue.toLowerCase()
      );
    }

    const container = document.getElementById("issues");

    if (issues.length === 0) {
      container.innerHTML =
        "<div class='col-12 text-center'><p class='text-muted'>No issues found for this category.</p></div>";
      return;
    }

    container.innerHTML = issues
      .map(
        (issue) => `
            <div class="col-md-4 mb-4">
                <div class="card h-100 card-shadow">
                    <img src="${issue.imageUrl}" class="card-img-top">
                    <div class="card-body">
                        <span class="badge bg-info text-dark mb-2 text-capitalize">${
                          issue.category
                        }</span>
                        <p class="card-text">${issue.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">📍 ${
                              issue.location
                            }</small>
                            <span class="badge bg-light text-dark border">${
                              issue.status || "Pending"
                            }</span>
                        </div>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  } catch (err) {
    console.error("Load failed", err);
  }
}

// 3. Add an Event Listener so it updates instantly when you click the dropdown
document
  .getElementById("categoryFilter")
  .addEventListener("change", loadIssues);

function logout() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) cognitoUser.signOut();
  window.location.reload();
}

// Init
checkAuth();
loadIssues();
