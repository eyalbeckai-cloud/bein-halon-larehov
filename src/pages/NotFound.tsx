import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="page page--soft">
      <div className="prose">
        <h1>העמוד לא נמצא</h1>
        <p>ייתכן שהכתובת השתנתה או שנפלה בה טעות.</p>
        <p style={{ marginTop: '2rem' }}>
          <Link to="/" className="btn btn--ink">
            לעמוד הספר
          </Link>
        </p>
      </div>
    </div>
  )
}
