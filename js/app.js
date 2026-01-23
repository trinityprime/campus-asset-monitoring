const backendUrl = "http://campus-lb-742208453.us-east-1.elb.amazonaws.com";

let poolData = {};
let userPool;

let authModal;
let toastElement;
let bsToast;

document.addEventListener("DOMContentLoaded", async () => {
  authModal = new bootstrap.Modal(document.getElementById("authModal"));
  toastElement = document.getElementById("liveToast");
  bsToast = new bootstrap.Toast(toastElement);

  try {
    const res = await fetch(`${backendUrl}/config`);
    const config = await res.json();
    poolData = config;
    userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    checkAuth();
    loadIssues();
  } catch (err) {
    console.error("Failed to load auth config:", err);
    showToast("Failed to initialize app. Please refresh.", "error");
  }
});

// Helper function to replace alert()
function showToast(message, type = "success") {
  const toastBody = document.getElementById("toastBody");
  toastElement.classList.remove("bg-success", "bg-danger", "bg-warning");

  if (type === "success") toastElement.classList.add("bg-success");
  if (type === "error") toastElement.classList.add("bg-danger");
  if (type === "warning") toastElement.classList.add("bg-warning");

  toastBody.textContent = message;
  bsToast.show();
}

function checkUserIsAdmin() {
  const user = userPool.getCurrentUser();
  if (!user) return false;

  const storageKey = `CognitoIdentityServiceProvider.${poolData.ClientId}.${user.username}.idToken`;
  const idToken = localStorage.getItem(storageKey);
  if (!idToken) return false;

  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    const groups = payload["cognito:groups"] || [];
    return groups.includes("Admin");
  } catch (e) {
    return false;
  }
}

function handleReportClick() {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        authModal.show();
      } else {
        const reportCard = document.getElementById("reportCard");
        reportCard.classList.remove("hidden");
        document.getElementById("reportForm").reset();
        document.getElementById("imagePreview").style.display = "none";
        document.getElementById("imagePreview").src = "#";
        reportCard.scrollIntoView({ behavior: "smooth" });
      }
    });
  } else {
    authModal.show();
  }
}

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
    if (err) return showToast(err.message, "error");

    document.getElementById("registerSection").classList.add("hidden");
    document.getElementById("verifySection").classList.remove("hidden");
    showToast("Verification code sent to " + email);
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
    if (err) return showToast(err.message, "error");
    showToast("Verified! You can now sign in.");
    // Simplified auth toggle
    document.getElementById("registerSection").classList.remove("hidden");
    document.getElementById("verifySection").classList.add("hidden");
  });
}

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
      authModal.hide();
      checkAuth();
      showToast("Welcome back, " + username + "!");

      if (checkUserIsAdmin()) {
        document
          .querySelectorAll(".admin-panel")
          .forEach((p) => p.classList.remove("hidden"));
      }
      document.getElementById("reportCard").classList.remove("hidden");
    },
    onFailure: (err) => showToast(err.message, "error"),
  });
}

function checkAuth() {
  const cognitoUser = userPool.getCurrentUser();
  const logoutBtn = document.getElementById("logoutBtn");
  const userWelcome = document.getElementById("userWelcome");

  if (cognitoUser) {
    cognitoUser.getSession((err, session) => {
      if (session && session.isValid()) {
        if (logoutBtn) logoutBtn.classList.remove("hidden");
        if (userWelcome) {
          userWelcome.textContent = `Welcome, ${cognitoUser.getUsername()}`;
          userWelcome.classList.remove("hidden");
        }
      } else {
        showLoggedOutState();
      }
    });
  } else {
    showLoggedOutState();
  }
}

function showLoggedOutState() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.classList.add("hidden");
  const userWelcome = document.getElementById("userWelcome");
  if (userWelcome) userWelcome.classList.add("hidden");
}

async function updateStatus(issueId, newStatus) {
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) return;

  cognitoUser.getSession(async (err, session) => {
    if (err) return showToast("Session expired.", "error");

    const token = session.getIdToken().getJwtToken();

    try {
      const res = await fetch(`${backendUrl}/api/issues/${issueId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showToast("Status updated to " + newStatus);
        const badge = document.getElementById(`badge-${issueId}`);
        if (badge) {
          badge.textContent = newStatus;
          badge.className =
            "badge rounded-pill border " +
            (newStatus === "Resolved"
              ? "bg-success text-white"
              : newStatus === "In Progress"
                ? "bg-warning text-dark"
                : "bg-light text-dark");
        }
      } else {
        showToast("Update failed. Admins only.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Server error.", "error");
    }
  });
}

document
  .getElementById("issueImage")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    const preview = document.getElementById("imagePreview");

    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      preview.style.display = "none";
    }
  });

// --- AI Auto-Fill Logic ---
document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("issueImage");
  if (!fileInput.files[0])
    return showToast("Please select an image first!", "warning");

  const btn = document.getElementById("analyzeBtn");
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
  btn.disabled = true;

  const formData = new FormData();
  formData.append("image", fileInput.files[0]);

  try {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) return authModal.show();

    // Get session for Authorization
    const session = await new Promise((res, rej) => {
      cognitoUser.getSession((err, s) => (err ? rej(err) : res(s)));
    });
    const token = session.getIdToken().getJwtToken();

    const res = await fetch(`${backendUrl}/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) throw new Error("Analysis failed");

    const data = await res.json();

    const labels = data.labels.slice(0, 3).map((l) => l.toLowerCase());
    let description = "";

    if (labels.length >= 2) {
      const lastLabel = labels.pop();
      description = `The reported issue involves ${labels.join(
        ", ",
      )} and ${lastLabel}. `;
    } else if (labels.length === 1) {
      description = `This issue is related to ${labels[0]}. `;
    } else {
      description = `New campus issue reported. `;
    }

    if (data.text && data.text.length > 0) {
      const visibleText = data.text.slice(0, 2).join(" / ");
      description += `Visible text in the image includes: "${visibleText}".`;
    }

    document.querySelector('textarea[name="description"]').value = description;

    const categoryMap = {
      Furniture: ["Chair", "Table", "Desk", "Couch", "Furniture", "Seat"],
      Electrical: ["Light", "Bulb", "Wire", "Socket", "Electricity", "Power"],
      Infrastructure: [
        "Wall",
        "Floor",
        "Ceiling",
        "Door",
        "Window",
        "Water",
        "Leak",
      ],
      "IT Equipment": ["Screen", "Monitor", "Computer", "Projector", "Cable"],
      Sanitation: ["Trash", "Waste", "Garbage", "Liquid", "Stain", "Graffiti"],
    };

    let suggestedCat = "Infrastructure"; // Fallback
    for (let label of data.labels) {
      for (let [cat, keywords] of Object.entries(categoryMap)) {
        if (
          keywords.some((k) => label.toLowerCase().includes(k.toLowerCase()))
        ) {
          suggestedCat = cat;
          break;
        }
      }
      if (suggestedCat !== "Infrastructure") break;
    }

    document.querySelector('select[name="category"]').value = suggestedCat;

    if (data.text.length > 0) {
      const roomMatch = data.text.find(
        (t) => t.match(/[A-Z]?\d-\d/i) || t.toLowerCase().includes("room"),
      );
      if (roomMatch)
        document.querySelector('input[name="location"]').value = roomMatch;
    }

    showToast("AI Auto-filled your form!", "success");
  } catch (err) {
    console.error(err);
    showToast("Could not analyze image.", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

async function loadIssues() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    let issues = await res.json();
    const isAdmin = checkUserIsAdmin();
    const categoryFilterValue = document.getElementById("categoryFilter").value;
    const aiLabelFilterValue = document.getElementById("aiLabelFilter").value;

    // Filter by category
    if (categoryFilterValue) {
      issues = issues.filter(
        (i) => i.category.toLowerCase() === categoryFilterValue.toLowerCase(),
      );
    }

    // Filter by AI labels
    if (aiLabelFilterValue) {
      issues = issues.filter(
        (i) => i.aiLabels && i.aiLabels.includes(aiLabelFilterValue),
      );
    }

    // Populate AI Label filter dropdown with unique labels from all issues
    updateAILabelFilter();

    const container = document.getElementById("issues");
    if (issues.length === 0) {
      container.innerHTML =
        "<p class='text-center mt-5 text-muted'>No issues reported.</p>";
      return;
    }

    container.innerHTML = issues
      .map((issue) => {
        const currentStatus = issue.status || "New";
        let badgeClass =
          currentStatus === "In Progress"
            ? "bg-warning text-dark"
            : currentStatus === "Resolved"
              ? "bg-success text-white"
              : "bg-light text-dark";

        const datePosted = issue.reportedAt
          ? new Date(issue.reportedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Recently";

        // --- NEW: Process AI Data ---
        // Show top 3 AI Labels as hashtags
        const labelHTML =
          issue.aiLabels && issue.aiLabels.length > 0
            ? issue.aiLabels
                .slice(0, 3)
                .map(
                  (l) =>
                    `<span class="badge rounded-pill bg-light text-secondary border me-1" style="font-size: 0.6rem;">#${l}</span>`,
                )
                .join("")
            : "";

        // Show Detected Text only if it's relevant (e.g., Room numbers/Signs)
        const textHTML =
          issue.detectedText && issue.detectedText.length > 0
            ? `<div class="mt-2 p-2 bg-light rounded border-start border-primary border-3" style="font-size: 0.75rem;">
             <strong class="text-primary">AI Detected Text:</strong> 
             <span class="text-dark">${issue.detectedText
               .slice(0, 2)
               .join(", ")}</span>
           </div>`
            : "";

        const adminControls = `<div class="admin-panel ${
          isAdmin ? "" : "hidden"
        } mt-3 pt-3 border-top">
          <label class="small fw-bold text-muted d-block mb-1">Admin Status Update:</label>
          <select class="form-select form-select-sm" onchange="updateStatus('${
            issue.issueId
          }', this.value)">
              <option value="New" ${
                currentStatus === "New" ? "selected" : ""
              }>New</option>
              <option value="In Progress" ${
                currentStatus === "In Progress" ? "selected" : ""
              }>In Progress</option>
              <option value="Resolved" ${
                currentStatus === "Resolved" ? "selected" : ""
              }>Resolved</option>
          </select>
      </div>`;

        return `
        <div class="col-md-4 mb-4">
          <div class="card h-100 card-shadow border-0">
              <div class="img-container">
                  <img src="${issue.imageUrl}" class="card-img-top" alt="Issue" onload="this.style.opacity='1'" style="opacity:0; transition: opacity 0.3s ease;">
              </div>
              <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                      <span class="badge bg-soft-primary text-primary text-capitalize">${issue.category}</span>
                      <small class="text-muted" style="font-size: 0.75rem;">${datePosted}</small>
                  </div>
                  
                  <p class="card-text fw-bold mb-1">${issue.description}</p>
                  
                  <div class="mb-2">
                    ${labelHTML} </div>

                  <div class="d-flex justify-content-between align-items-center">
                      <small class="text-muted">📍 ${issue.location}</small>
                      <span id="badge-${issue.issueId}" class="badge rounded-pill border ${badgeClass}">${currentStatus}</span>
                  </div>

                  ${textHTML} ${adminControls}
              </div>
          </div>
        </div>`;
      })
      .join("");
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

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
        showToast("Thank you! Report submitted.");
        e.target.reset();
        document.getElementById("imagePreview").style.display = "none";
        document.getElementById("imagePreview").src = "#";
        document.getElementById("reportCard").classList.add("hidden");
        loadIssues();
      }
    } catch (err) {
      showToast("Connection error.", "error");
    }
  });
});

function logout() {
  const user = userPool.getCurrentUser();
  if (user) user.signOut();
  showToast("Logged out successfully");
  setTimeout(() => window.location.reload(), 1000);
}

async function updateAILabelFilter() {
  try {
    const res = await fetch(`${backendUrl}/api/issues`);
    const issues = await res.json();

    const uniqueLabels = new Set();
    issues.forEach((issue) => {
      if (issue.aiLabels && Array.isArray(issue.aiLabels)) {
        issue.aiLabels.forEach((label) => uniqueLabels.add(label));
      }
    });

    const sortedLabels = Array.from(uniqueLabels).sort();

    const selectElement = document.getElementById("aiLabelFilter");
    const currentValue = selectElement.value;

    while (selectElement.options.length > 1) {
      selectElement.remove(1);
    }

    sortedLabels.forEach((label) => {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      selectElement.appendChild(option);
    });

    selectElement.value = currentValue;
  } catch (err) {
    console.error("Failed to update AI label filter:", err);
  }
}

document
  .getElementById("categoryFilter")
  .addEventListener("change", loadIssues);

document.getElementById("aiLabelFilter").addEventListener("change", loadIssues);

function clearCategoryFilter() {
  document.getElementById("categoryFilter").value = "";
  loadIssues();
}

function clearAILabelFilter() {
  document.getElementById("aiLabelFilter").value = "";
  loadIssues();
}
