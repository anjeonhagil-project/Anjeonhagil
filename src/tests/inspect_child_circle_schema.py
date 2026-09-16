from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

CHILD_DB = (
    BASE_DIR
    / "data"
    / "child_circle.sqlite"
)


def main():
    with sqlite3.connect(CHILD_DB) as conn:

        # 1. 테이블 목록 확인
        tables = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
            """
        ).fetchall()

        print("=== child_circle.sqlite 테이블 목록 ===")

        for table in tables:
            print(table[0])

        # 2. edge_child_circle 컬럼 확인
        print("\n=== edge_child_circle 컬럼 목록 ===")

        columns = conn.execute(
            """
            PRAGMA table_info(edge_child_circle)
            """
        ).fetchall()

        for column in columns:
            print(
                f"{column[0]}: "
                f"{column[1]} "
                f"({column[2]})"
            )


if __name__ == "__main__":
    main()