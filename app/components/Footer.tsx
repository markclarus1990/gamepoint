import { Gamepad2 } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer id="footer" className="border-t border-zinc-800 bg-black px-4 py-12 md:py-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 className="w-5 h-5 text-pink-500" />
              <span className="text-lg font-black tracking-wider text-white">
                GAME<span className="text-pink-500">POINT</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your premium gaming destination for competitive play and
              unforgettable experiences.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wider">QUICK LINKS</h4>
            <div className="space-y-2.5 text-sm">
              <div>
                <Link href="/" className="text-gray-400 hover:text-pink-400 transition-colors">
                  Home
                </Link>
              </div>
              <div>
                <Link href="/#top-players" className="text-gray-400 hover:text-pink-400 transition-colors">
                  Leaderboard
                </Link>
              </div>
              <div>
                <Link href="/tekken" className="text-gray-400 hover:text-pink-400 transition-colors">
                  Tournaments
                </Link>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wider">ACCOUNT</h4>
            <div className="space-y-2.5 text-sm">
              <div>
                <Link href="/login" className="text-gray-400 hover:text-pink-400 transition-colors">
                  Login
                </Link>
              </div>
              <div>
                <Link href="/register" className="text-gray-400 hover:text-pink-400 transition-colors">
                  Register
                </Link>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-4 tracking-wider">CONTACT</h4>
            <div className="space-y-2.5 text-sm text-gray-400">
              <p>GamePoint Internet Cafe</p>
              <p>Your Local Gaming Spot</p>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} GamePoint. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
