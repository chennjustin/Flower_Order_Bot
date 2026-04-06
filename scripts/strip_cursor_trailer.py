import sys


def main() -> None:
    lines = sys.stdin.read().splitlines()
    cleaned = [l for l in lines if l.strip() != "Made-with: Cursor"]
    sys.stdout.write("\n".join(cleaned) + "\n")


if __name__ == "__main__":
    main()

