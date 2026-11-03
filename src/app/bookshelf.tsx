"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import type { BookRecord, BookStatus } from "./hobby-data";

type BookshelfProps = {
  books: BookRecord[];
  onChange: (books: BookRecord[]) => void;
  onDone: () => void;
};

type SearchBook = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
};

type SearchResponse = { docs?: SearchBook[] };
type ImportTab = "search" | "paste" | "goodreads" | "photo";

const statuses: BookStatus[] = ["Want to read", "Currently reading", "Read"];
const openLibrarySearch = "https://openlibrary.org/search.json";

function newBookId() {
  return globalThis.crypto.randomUUID();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function statusFromShelf(value: string): BookStatus {
  const shelf = value.trim().toLowerCase().replaceAll("_", "-");
  if (shelf === "currently-reading" || shelf === "currently reading") return "Currently reading";
  if (shelf === "read") return "Read";
  return "Want to read";
}

function parsePastedList(value: string): Omit<BookRecord, "id">[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s+(?:—|–|-|\bby\b)\s+(.+)$/i);
      return {
        title: match?.[1]?.trim() || line,
        author: match?.[2]?.trim() || "",
        status: "Want to read",
      };
    });
}

function coverFor(book: SearchBook) {
  return book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined;
}

export default function Bookshelf({ books, onChange, onDone }: BookshelfProps) {
  const [tab, setTab] = useState<ImportTab>("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [draftBooks, setDraftBooks] = useState<BookRecord[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoText, setPhotoText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  async function searchCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const url = new URL(openLibrarySearch);
      url.searchParams.set("q", query.trim());
      url.searchParams.set("limit", "8");
      url.searchParams.set("fields", "key,title,author_name,cover_i,first_publish_year");
      const response = await fetch(url);
      if (!response.ok) throw new Error("The catalogue is unavailable right now.");
      const data = (await response.json()) as SearchResponse;
      setSearchResults(data.docs ?? []);
      if (!data.docs?.length) setSearchError("No matches yet. Try another title or paste it into your list.");
    } catch {
      setSearchError("Search could not connect. Check your connection, or add the book from a pasted list.");
    } finally {
      setSearching(false);
    }
  }

  function queueBook(book: Omit<BookRecord, "id">) {
    const duplicate = [...books, ...draftBooks].some(
      (item) => item.title.toLowerCase() === book.title.toLowerCase() && item.author.toLowerCase() === book.author.toLowerCase(),
    );
    if (duplicate) {
      setImportMessage("That title is already on your shelf or in this review list.");
      return;
    }
    setDraftBooks((current) => [...current, { ...book, id: newBookId() }]);
    setImportMessage("");
  }

  function queuePastedBooks(value: string) {
    const parsed = parsePastedList(value);
    if (!parsed.length) {
      setImportMessage("Add one title per line to start your review list.");
      return;
    }
    parsed.forEach(queueBook);
    setImportMessage(`${parsed.length} ${parsed.length === 1 ? "book is" : "books are"} ready to review.`);
  }

  async function handleGoodreadsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportMessage("Choose the CSV file exported from Goodreads.");
      return;
    }
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("No rows found");
      const headers = rows[0].map((header) => header.trim().toLowerCase());
      const titleIndex = headers.indexOf("title");
      const authorIndex = headers.indexOf("author");
      const shelfIndex = headers.indexOf("exclusive shelf");
      if (titleIndex < 0 || authorIndex < 0) {
        setImportMessage("This file does not look like a Goodreads library export. Check that it includes Title and Author columns.");
        return;
      }
      let added = 0;
      rows.slice(1).forEach((row) => {
        const title = row[titleIndex]?.trim();
        if (!title) return;
        queueBook({
          title,
          author: row[authorIndex]?.trim() || "",
          status: statusFromShelf(shelfIndex >= 0 ? row[shelfIndex] ?? "" : ""),
        });
        added += 1;
      });
      setImportMessage(`${added} ${added === 1 ? "book is" : "books are"} ready to review. The CSV was read in this browser.`);
    } catch {
      setImportMessage("We couldn’t read that CSV. Try exporting your library from Goodreads again.");
    }
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImportMessage("Choose a photo or screenshot image.");
      return;
    }
    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setImportMessage("Photo preview is ready. Image recognition is not available yet; type or paste the visible titles below.");
  }

  function importReviewedBooks() {
    onChange([...books, ...draftBooks]);
    setDraftBooks([]);
    setImportMessage("Books added to your bookshelf.");
  }

  function updateBookStatus(id: string, status: BookStatus) {
    onChange(books.map((book) => book.id === id ? { ...book, status } : book));
  }

  function removeBook(id: string) {
    onChange(books.filter((book) => book.id !== id));
  }

  return (
    <section className="bookshelf-screen" aria-labelledby="bookshelf-title">
      <div className="bookshelf-heading">
        <div>
          <p className="eyebrow">A small library, all yours</p>
          <h1 id="bookshelf-title">Your <em>bookshelf.</em></h1>
          <p className="bookshelf-intro">Save the stories you’re reading, dreaming about, and already love.</p>
        </div>
        <span className="bookshelf-count">{books.length}<small>{books.length === 1 ? "book" : "books"}</small></span>
      </div>

      <div className="bookshelf-main">
        <div className="import-section">
          <div className="import-title-row"><div><p className="eyebrow">Bring your books together</p><h2>Add to your shelf</h2></div></div>
          <div className="import-tabs" role="tablist" aria-label="Book import options">
            {([
              ["search", "Search books"],
              ["paste", "Paste a list"],
              ["goodreads", "Goodreads CSV"],
              ["photo", "Photo / screenshot"],
            ] as [ImportTab, string][]).map(([id, label]) => (
              <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => { setTab(id); setImportMessage(""); }}>{label}</button>
            ))}
          </div>

          {tab === "search" && (
            <div className="import-pane" role="tabpanel">
              <form className="catalog-search" onSubmit={searchCatalog}>
                <label htmlFor="book-query">Find a title or author</label>
                <div className="catalog-search-row"><input id="book-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try The Secret Garden" /><button className="primary-button" type="submit" disabled={searching || !query.trim()}>{searching ? "Searching…" : "Search"}</button></div>
              </form>
              <p className="source-note"><span className="integration-status tested">Tested</span> Live search via the public Open Library catalogue.</p>
              {searchError && <p className="inline-message" role="status">{searchError}</p>}
              {searchResults.length > 0 && <div className="search-results" aria-live="polite">{searchResults.map((result) => {
                const candidate = { title: result.title, author: result.author_name?.[0] ?? "", status: "Want to read" as const, coverUrl: coverFor(result) };
                const alreadyQueued = [...books, ...draftBooks].some((book) => book.title.toLowerCase() === candidate.title.toLowerCase() && book.author.toLowerCase() === candidate.author.toLowerCase());
                return <article className="search-book" key={result.key}><BookCover book={candidate} /><div className="search-book-copy"><h3>{result.title}</h3><p>{candidate.author || "Author unknown"}{result.first_publish_year ? ` · ${result.first_publish_year}` : ""}</p></div><button className="add-book-button" type="button" disabled={alreadyQueued} onClick={() => queueBook(candidate)}>{alreadyQueued ? "Added" : "Add"}</button></article>;
              })}</div>}
            </div>
          )}

          {tab === "paste" && (
            <div className="import-pane" role="tabpanel">
              <label className="pane-label" htmlFor="book-list">One book per line. Add an author with “Title — Author” or “Title by Author”.</label>
              <textarea id="book-list" className="book-list-input" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"The Hobbit — J.R.R. Tolkien\nBraiding Sweetgrass by Robin Wall Kimmerer\nPride and Prejudice"} />
              <button className="secondary-button" type="button" onClick={() => queuePastedBooks(pasteText)}>Review these books</button>
            </div>
          )}

          {tab === "goodreads" && (
            <div className="import-pane import-info-pane" role="tabpanel">
              <span className="import-illustration" aria-hidden="true">↗</span>
              <div><h3>Bring over your Goodreads library <span className="integration-status prototype">Prototype</span></h3><p>On Goodreads, sign in and choose <strong>My Books → Import and export → Export Library</strong>. Then upload the CSV here. The parser is implemented, but still needs validation against a real Goodreads export. Hobbymaxxing never asks for your Goodreads password.</p><a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer">Open Goodreads import and export <span aria-hidden="true">↗</span></a></div>
              <label className="secondary-button file-button">Choose Goodreads CSV<input type="file" accept=".csv,text/csv" onChange={handleGoodreadsFile} /></label>
              <p className="privacy-note">The file is read in your browser and is not uploaded to Goodreads or a Hobbymaxxing server.</p>
            </div>
          )}

          {tab === "photo" && (
            <div className="import-pane photo-pane" role="tabpanel">
              <label className="photo-picker"><span aria-hidden="true">＋</span><strong>Choose a screenshot or photo</strong><small>JPG, PNG, or another image format</small><input type="file" accept="image/*" capture="environment" onChange={handlePhoto} /></label>
              {photoUrl && <div className="photo-preview"><Image src={photoUrl} alt="Selected book list image preview" width={300} height={220} unoptimized /></div>}
              <div className="planned-note"><span className="planned-badge">OCR planned</span><p>Photo preview works locally, but automatic text recognition isn’t available yet. Type or paste visible titles below to review them before adding them.</p></div>
              <label className="pane-label" htmlFor="photo-titles">Titles from your image</label>
              <textarea id="photo-titles" className="book-list-input" value={photoText} onChange={(event) => setPhotoText(event.target.value)} placeholder={"Add one visible title per line"} />
              <button className="secondary-button" type="button" onClick={() => queuePastedBooks(photoText)}>Review these titles</button>
            </div>
          )}

          {importMessage && <p className="import-message" role="status">{importMessage}</p>}

          {draftBooks.length > 0 && (
            <section className="review-panel" aria-labelledby="review-title">
              <div className="review-heading"><div><p className="eyebrow">Nothing is added until you say so</p><h3 id="review-title">Review your books <span>{draftBooks.length}</span></h3></div><button className="quiet-button" type="button" onClick={() => setDraftBooks([])}>Clear list</button></div>
              <div className="review-list">{draftBooks.map((book) => <article className="review-book" key={book.id}><BookCover book={book} /><div className="review-book-info"><strong>{book.title}</strong><span>{book.author || "Author not listed"}</span></div><label className="status-select-label"><span className="sr-only">Reading status for {book.title}</span><select value={book.status} onChange={(event) => setDraftBooks((current) => current.map((item) => item.id === book.id ? { ...item, status: event.target.value as BookStatus } : item))}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><button className="remove-book-button" type="button" aria-label={`Remove ${book.title} from review`} onClick={() => setDraftBooks((current) => current.filter((item) => item.id !== book.id))}>×</button></article>)}</div>
              <button className="primary-button confirm-import" type="button" onClick={importReviewedBooks}>Add {draftBooks.length} {draftBooks.length === 1 ? "book" : "books"} to my shelf <span aria-hidden="true">→</span></button>
            </section>
          )}
        </div>

        <aside className="shelf-panel" aria-labelledby="my-shelf-title">
          <div className="shelf-panel-heading"><div><p className="eyebrow">Your collection</p><h2 id="my-shelf-title">On your shelf</h2></div><span className="shelf-panel-count">{books.length}</span></div>
          {books.length === 0 ? <div className="shelf-empty"><span aria-hidden="true">📚</span><p>Your books will find a home here.</p><small>Search, paste a list, or import a CSV to begin.</small></div> : (
            <div className="shelf-list">{books.map((book) => <article className="shelf-book" key={book.id}><BookCover book={book} /><div className="shelf-book-info"><strong>{book.title}</strong><span>{book.author || "Author not listed"}</span><select aria-label={`Reading status for ${book.title}`} value={book.status} onChange={(event) => updateBookStatus(book.id, event.target.value as BookStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><button className="remove-book-button" type="button" aria-label={`Remove ${book.title} from bookshelf`} onClick={() => removeBook(book.id)}>×</button></article>)}</div>
          )}
          <p className="shelf-local-note">Saved on this device</p>
        </aside>
      </div>

      <div className="flow-actions bookshelf-actions"><button className="quiet-button" type="button" onClick={onDone}>Back</button><button className="primary-button" type="button" onClick={onDone}>Done <span aria-hidden="true">✓</span></button></div>
    </section>
  );
}

function BookCover({ book }: { book: Pick<BookRecord, "title" | "coverUrl"> }) {
  return book.coverUrl ? <Image className="book-cover" src={book.coverUrl} alt={`${book.title} cover`} width={42} height={60} unoptimized /> : <span className="book-cover-placeholder" aria-label="No cover available" aria-hidden="true">✿</span>;
}
