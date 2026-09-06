import { test, expect, request as playwrightRequest } from "@playwright/test";
import {
  testDatabase,
  createTestUser,
  removeTestUsers,
} from "../../scripts/test-fixtures.mjs";

test("six-feature faculty assessment journey uses live PostgreSQL and enforces ownership", async ({
  page,
}) => {
  test.setTimeout(480000);
  const database = await testDatabase();
  const users = [
    await createTestUser(database),
    await createTestUser(database),
  ];
  const other = await playwrightRequest.newContext({
    baseURL: "http://localhost:3011",
  });
  try {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(users[0].email);
    await page.getByLabel("Password", { exact: true }).fill(users[0].password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    expect(
      (
        await other.post("/api/auth/login", {
          data: { email: users[1].email, password: users[1].password },
        })
      ).ok(),
    ).toBe(true);

    const today = new Date(),
      start = new Date(today.valueOf() - 7 * 86400000),
      end = new Date(today.valueOf() + 100 * 86400000);
    const date = (d: Date) => d.toISOString().slice(0, 10);
    const create = await page.request.post("/api/faculty/courses", {
      data: {
        code: "CSE401",
        title: "Artificial Intelligence",
        semester_start: date(start),
        semester_end: date(end),
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const course = (await create.json()).course;
    expect((await other.get("/api/faculty")).ok()).toBe(true);
    expect(
      (await (await other.get("/api/faculty")).json()).courses,
    ).toHaveLength(0);
    expect(
      (
        await other.post("/api/faculty/syllabus", {
          data: {
            course_id: course.id,
            content: "Attempt to steal this course data from another account.",
            source_name: "bad",
            clos: [],
            topics: ["Bad"],
            progress_percent: 1,
          },
        })
      ).status(),
    ).toBe(404);

    const syllabus = await page.request.post("/api/faculty/syllabus", {
      data: {
        course_id: course.id,
        content:
          "Introduction to AI. Intelligent agents. Uninformed and informed search. Knowledge representation. Machine learning fundamentals. Neural networks. Ethics and responsible AI.",
        source_name: "manual",
        clos: [
          "Explain core AI concepts",
          "Apply search algorithms",
          "Evaluate responsible AI",
        ],
        topics: [
          "Introduction",
          "Agents",
          "Search",
          "Knowledge representation",
          "Machine learning",
          "Neural networks",
          "AI ethics",
        ],
        progress_percent: 55,
      },
    });
    expect(syllabus.status(), await syllabus.text()).toBe(200);
    expect(
      (
        await page.request.post("/api/faculty/routines", {
          data: {
            course_id: course.id,
            weekday: 1,
            start_time: "10:00",
            end_time: "11:30",
            room: "Lab 2",
          },
        })
      ).status(),
    ).toBe(201);

    const upload = (name: string, text: string) => ({
      name,
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    const firstAnalysis = await page.request.post("/api/faculty/assignments", {
      multipart: {
        course_id: course.id,
        file: upload(
          "submission-a.txt",
          "Artificial intelligence systems analyze information and identify patterns. This report discusses search algorithms, knowledge representation, and responsible use. The student explains each idea with examples from the assigned course project and reflects on limitations.",
        ),
      },
    });
    expect(firstAnalysis.status(), await firstAnalysis.text()).toBe(201);
    const analysis = (await firstAnalysis.json()).analysis;
    expect(Number(analysis.ai_likelihood)).toBeGreaterThanOrEqual(0);
    expect(analysis.disclaimer).toMatch(/not definitive proof/i);
    const duplicateAnalysis = await page.request.post(
      "/api/faculty/assignments",
      {
        multipart: {
          course_id: course.id,
          file: upload(
            "renamed.txt",
            "Artificial intelligence systems analyze information and identify patterns. This report discusses search algorithms, knowledge representation, and responsible use. The student explains each idea with examples from the assigned course project and reflects on limitations.",
          ),
        },
      },
    );
    expect(duplicateAnalysis.status()).toBe(409);
    const secondAnalysis = await page.request.post("/api/faculty/assignments", {
      multipart: {
        course_id: course.id,
        file: upload(
          "submission-b.txt",
          "Artificial intelligence systems analyze information and identify patterns. This report discusses search algorithms, knowledge representation, and responsible use. The student explains each idea with examples from the course project and reflects on practical limitations.",
        ),
      },
    });
    expect(secondAnalysis.status(), await secondAnalysis.text()).toBe(201);
    expect(
      Number((await secondAnalysis.json()).analysis.similarity_percent),
    ).toBeGreaterThan(60);

    for (const [year, text] of [
      [
        2024,
        "1. Explain A star search with an example?\n2. Compare supervised and unsupervised machine learning?",
      ],
      [
        2025,
        "1. Describe the A star search algorithm using a suitable example?\n2. Discuss ethical risks in artificial intelligence systems?",
      ],
    ] as const) {
      const r = await page.request.post("/api/faculty/previous-papers", {
        multipart: {
          course_id: course.id,
          year: String(year),
          file: upload(`questions-${year}.txt`, text),
        },
      });
      expect(r.status(), await r.text()).toBe(201);
    }
    const matchResponse = await page.request.get(
      `/api/faculty/previous-matches?course_id=${course.id}`,
    );
    expect(matchResponse.ok()).toBe(true);
    const matches = (await matchResponse.json()).matches;
    expect(matches).toHaveLength(4);
    expect(
      Math.max(...matches.map((m: { similarity: number }) => m.similarity)),
    ).toBeGreaterThan(50);

    const planResponse = await page.request.post("/api/faculty/plans", {
      data: {
        course_id: course.id,
        quiz_count: 2,
        include_midterm: true,
        include_final: true,
      },
      timeout: 60000,
    });
    expect(planResponse.status(), await planResponse.text()).toBe(201);
    const plan = (await planResponse.json()).assessments;
    expect(plan).toHaveLength(4);
    expect(
      plan.reduce(
        (n: number, a: { weight_percent: string }) =>
          n + Number(a.weight_percent),
        0,
      ),
    ).toBeLessThanOrEqual(100);
    const tomorrow = date(new Date(Date.now() + 86400000));
    const approved = await page.request.patch("/api/faculty/assessments", {
      data: { id: plan[0].id, scheduled_on: tomorrow, status: "approved" },
    });
    expect(approved.status(), await approved.text()).toBe(200);

    const generated = await page.request.post("/api/faculty/questions", {
      data: {
        course_id: course.id,
        assessment_id: plan[0].id,
        assessment_type: "quiz",
        count: 2,
        marks_each: 5,
        difficulty: "medium",
        clo: "Apply search algorithms",
      },
      timeout: 60000,
    });
    expect(generated.status(), await generated.text()).toBe(201);
    const questions = (await generated.json()).questions;
    expect(questions).toHaveLength(2);
    expect(Number(questions[0].syllabus_relevance)).toBeGreaterThanOrEqual(0);
    expect(Number(questions[0].previous_similarity)).toBeGreaterThanOrEqual(0);
    expect(
      (
        await page.request.patch("/api/faculty/questions", {
          data: { id: questions[0].id, status: "approved" },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.patch("/api/faculty/questions", {
          data: {
            id: questions[1].id,
            question_text:
              questions[1].question_text + " Explain your reasoning.",
          },
          timeout: 60000,
        })
      ).ok(),
    ).toBe(true);

    const notificationResponse = await page.request.post(
      "/api/faculty/notifications",
    );
    expect(notificationResponse.ok()).toBe(true);
    const notifications = (await notificationResponse.json()).notifications;
    expect(
      notifications.some((n: { kind: string }) => n.kind === "countdown"),
    ).toBe(true);
    expect(
      notifications.some((n: { kind: string }) => n.kind === "readiness"),
    ).toBe(true);
    expect(
      (
        await page.request.patch("/api/faculty/notifications", {
          data: { id: notifications[0].id, is_read: true },
        })
      ).ok(),
    ).toBe(true);
    const roadmapResponse = await page.request.post("/api/faculty/roadmap", {
      data: { horizon_days: 120 },
      timeout: 60000,
    });
    expect(roadmapResponse.status(), await roadmapResponse.text()).toBe(201);
    const roadmap = (await roadmapResponse.json()).roadmap;
    expect(roadmap.length).toBeGreaterThan(0);
    expect(
      roadmap.every(
        (i: { rationale: string; recommended_on: string }) =>
          i.rationale && i.recommended_on,
      ),
    ).toBe(true);

    await page.goto("/faculty");
    await expect(
      page.getByRole("heading", {
        name: "Assessments, with faculty in control.",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Active course")).toHaveValue(course.id);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const finalState = await page.request.get("/api/faculty");
    const state = await finalState.json();
    expect(state.analyses).toHaveLength(2);
    expect(state.papers).toHaveLength(2);
    expect(state.questions).toHaveLength(2);
    expect(state.roadmap.length).toBeGreaterThan(0);
  } finally {
    await other.dispose();
    await removeTestUsers(database, users);
    await database.end();
  }
});
