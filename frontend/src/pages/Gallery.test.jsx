import { fireEvent, render, screen } from "@testing-library/react";
import { Gallery } from "./Gallery.jsx";
import { IndexContext } from "../contexts/IndexContext.jsx";

function renderGallery(index) {
  return render(
    <IndexContext.Provider
      value={{
        index,
        isLoading: false,
        error: null,
        refreshIndex: async () => index,
      }}
    >
      <Gallery onNavigate={() => {}} scrollRef={{ current: null }} />
    </IndexContext.Provider>,
  );
}

describe("Gallery", () => {
  it("filters sessions by language and search", () => {
    renderGallery({
      sessions: [
        {
          id: "en-1",
          created_at: "2026-05-08T10:00:00+00:00",
          language: "en",
          title: "English practice",
          duration_seconds: 180,
          status: "ready",
          read: false,
        },
        {
          id: "fr-1",
          created_at: "2026-05-07T10:00:00+00:00",
          language: "fr",
          title: "French journal",
          duration_seconds: 240,
          status: "ready",
          read: true,
        },
      ],
    });

    expect(screen.getByText("English practice")).toBeInTheDocument();
    expect(screen.getByText("French journal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    fireEvent.click(screen.getByRole("button", { name: "FR" }));

    expect(screen.queryByText("English practice")).not.toBeInTheDocument();
    expect(screen.getByText("French journal")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search past sessions..."), {
      target: { value: "missing" },
    });

    expect(screen.getByText("No sessions match these filters.")).toBeInTheDocument();
  });
});
