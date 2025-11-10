#!/bin/bash

# POBIMORC CLI - OCR System Management Tool
# Single command to manage the entire OCR system

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/ocr-backend"
FRONTEND_DIR="$SCRIPT_DIR/ocr-browser"
LOGS_DIR="$SCRIPT_DIR/logs"
BACKEND_PID_FILE="$SCRIPT_DIR/.backend.pid"
FRONTEND_PID_FILE="$SCRIPT_DIR/.frontend.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Detect if running under WSL to allow Windows host IP discovery
is_wsl_environment() {
    if [ -n "$WSL_INTEROP" ] || grep -qi "microsoft" /proc/version 2>/dev/null; then
        return 0
    fi
    return 1
}

# Determine a usable LAN IP for sharing network URLs
get_network_host() {
    local ip=""
    local line=""
    local adapter=""
    
    # Allow manual override for environments with strict networking
    if [ -n "$POBIMORC_FRONTEND_HOST" ]; then
        echo "$POBIMORC_FRONTEND_HOST"
        return
    fi
    
    local linux_candidates=()
    local windows_candidates=()
    
    if command -v hostname >/dev/null 2>&1; then
        while read -r ip; do
            [ -n "$ip" ] && linux_candidates+=("$ip")
        done < <(hostname -I 2>/dev/null | tr ' ' '\n')
    fi
    
    if command -v ip >/dev/null 2>&1; then
        while read -r ip; do
            [ -n "$ip" ] && linux_candidates+=("$ip")
        done < <(ip -4 addr show scope global | awk '/inet / {sub("/.*","",$2); print $2}')
    fi
    
    if command -v ifconfig >/dev/null 2>&1; then
        while read -r ip; do
            [ -n "$ip" ] && linux_candidates+=("$ip")
        done < <(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ {gsub("addr:", "", $2); print $2}')
    fi
    
    # When running inside WSL, inspect Windows network adapters first
    if is_wsl_environment && command -v ipconfig.exe >/dev/null 2>&1; then
        while read -r line; do
            line=$(echo "$line" | tr -d '\r')
            
            if echo "$line" | grep -Ei 'adapter .*:'; then
                adapter="$line"
                continue
            fi
            
            if echo "$line" | grep -q "IPv4 Address"; then
                ip=$(echo "$line" | awk -F: '{gsub(/^[ \t]+/, "", $2); print $2}')
                if [ -n "$ip" ]; then
                    if echo "$adapter" | grep -qiE "WSL|Hyper-V|Default Switch|Loopback|Virtual"; then
                        continue
                    fi
                    windows_candidates+=("$ip")
                fi
            fi
        done < <(ipconfig.exe 2>/dev/null)
    fi
    
    local candidates=("${windows_candidates[@]}" "${linux_candidates[@]}")
    
    local -A seen=()
    local filtered=()
    for ip in "${candidates[@]}"; do
        ip=$(echo "$ip" | tr -d '[:space:]')
        if [ -z "$ip" ]; then
            continue
        fi
        if [[ "$ip" == 127.* ]]; then
            continue
        fi
        if ! [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            continue
        fi
        if [ -z "${seen[$ip]}" ]; then
            filtered+=("$ip")
            seen[$ip]=1
        fi
    done
    
    # Prefer 10.x ranges that are not Hyper-V host-only networks
    for ip in "${filtered[@]}"; do
        if [[ "$ip" == 10.* && "$ip" != 10.255.* ]]; then
            echo "$ip"
            return
        fi
    done
    
    # Fallback to any 10.x network if that's all we have
    for ip in "${filtered[@]}"; do
        if [[ "$ip" == 10.* ]]; then
            echo "$ip"
            return
        fi
    done
    
    for ip in "${filtered[@]}"; do
        case "$ip" in
            192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*)
                echo "$ip"
                return
                ;;
        esac
    done
    
    if [ ${#filtered[@]} -gt 0 ]; then
        echo "${filtered[0]}"
        return
    fi
    
    echo "localhost"
}

# Print functions
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║                                                   ║"
    echo "║              POBIMORC OCR System                  ║"
    echo "║           Thai OCR with CRAFT + EasyOCR           ║"
    echo "║                 Version $VERSION                    ║"
    echo "║                                                   ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_step() {
    echo -e "${MAGENTA}➜${NC} $1"
}

# Check if services are running
is_backend_running() {
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

is_frontend_running() {
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Show status
cmd_status() {
    print_banner
    echo -e "${CYAN}System Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Backend status
    if is_backend_running; then
        local pid=$(cat "$BACKEND_PID_FILE")
        print_success "Backend: ${GREEN}Running${NC} (PID: $pid, Port: 8005)"
    else
        print_warning "Backend: ${YELLOW}Stopped${NC}"
    fi
    
    # Frontend status
    if is_frontend_running; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        print_success "Frontend: ${GREEN}Running${NC} (PID: $pid, Port: 3005)"
        local frontend_network_host
        frontend_network_host=$(get_network_host)
        print_info "Frontend network URL: http://$frontend_network_host:3005"
    else
        print_warning "Frontend: ${YELLOW}Stopped${NC}"
    fi
    
    echo ""
    
    # Check installations
    if [ -d "$BACKEND_DIR/venv" ]; then
        print_success "Python venv: ${GREEN}Installed${NC}"
    else
        print_warning "Python venv: ${YELLOW}Not installed${NC} (run: pobimorc setup)"
    fi
    
    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        print_success "Node modules: ${GREEN}Installed${NC}"
    else
        print_warning "Node modules: ${YELLOW}Not installed${NC} (run: pobimorc setup)"
    fi
    
    echo ""
    
    # URLs
    if is_backend_running && is_frontend_running; then
        echo -e "${CYAN}Access URLs:${NC}"
        local frontend_network_host
        frontend_network_host=$(get_network_host)
        echo -e "  Frontend:  ${GREEN}http://localhost:3005${NC}"
        echo -e "  Frontend (Network): ${GREEN}http://$frontend_network_host:3005${NC}"
        echo -e "  Backend:   ${GREEN}http://localhost:8005${NC}"
        echo -e "  API Docs:  ${GREEN}http://localhost:8005/docs${NC}"
    fi
    
    echo ""
}

# Setup command
cmd_setup() {
    print_banner
    print_step "Starting system setup..."
    echo ""
    
    # Check Python 3.12
    print_step "Checking Python 3.12..."
    
    # Try to find Python 3.12 in different locations
    PYTHON_CMD=""
    if command -v python3.12 &> /dev/null; then
        PYTHON_CMD="python3.12"
    elif [ -f /usr/bin/python3.12 ]; then
        PYTHON_CMD="/usr/bin/python3.12"
    fi
    
    if [ -z "$PYTHON_CMD" ]; then
        print_error "Python 3.12 not found!"
        print_info "Install with: sudo apt-get install python3.12 python3.12-venv python3.12-dev"
        exit 1
    fi
    
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
    print_success "Found $PYTHON_VERSION at $(which $PYTHON_CMD || echo $PYTHON_CMD)"
    
    # Check if running in conda and warn
    if [ ! -z "$CONDA_DEFAULT_ENV" ]; then
        print_warning "Conda environment detected: $CONDA_DEFAULT_ENV"
        print_info "Will use system Python 3.12 to avoid conflicts"
    fi
    
    # Check Node.js
    print_step "Checking Node.js..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Found Node.js $NODE_VERSION"
    else
        print_error "Node.js not found!"
        print_info "Visit: https://nodejs.org/"
        exit 1
    fi
    
    # Check GPU
    print_step "Checking for NVIDIA GPU..."
    if command -v nvidia-smi &> /dev/null || [ -f /usr/lib/wsl/lib/nvidia-smi ]; then
        print_success "NVIDIA GPU detected"
    else
        print_warning "No GPU detected (will use CPU)"
    fi
    
    echo ""
    
    # Setup backend
    print_step "Setting up Python backend..."
    cd "$BACKEND_DIR"
    
    if [ -d "venv" ]; then
        print_warning "Removing old virtual environment..."
        rm -rf venv
    fi
    
    print_info "Creating Python 3.12 virtual environment..."
    print_info "Using: $PYTHON_CMD"
    $PYTHON_CMD -m venv venv
    
    if [ ! -d "venv" ]; then
        print_error "Failed to create virtual environment!"
        exit 1
    fi
    
    print_info "Activating virtual environment..."
    source venv/bin/activate
    
    print_info "Upgrading pip..."
    pip install --upgrade pip setuptools wheel
    
    if [ $? -ne 0 ]; then
        print_error "Failed to upgrade pip!"
        deactivate
        exit 1
    fi
    
    print_success "Pip upgraded successfully"
    
    print_info "Installing Python dependencies (this may take a while)..."
    pip install -r requirements.txt
    
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies!"
        print_info "Try running: pip install -r requirements.txt manually"
        deactivate
        exit 1
    fi
    
    # Fix craft-text-detector compatibility with torchvision
    print_info "Applying CRAFT compatibility fix for torchvision..."
    CRAFT_VGG_FILE="venv/lib/python3.12/site-packages/craft_text_detector/models/basenet/vgg16_bn.py"
    
    if [ -f "$CRAFT_VGG_FILE" ]; then
        print_info "Backing up original vgg16_bn.py..."
        cp "$CRAFT_VGG_FILE" "$CRAFT_VGG_FILE.backup"
        
        print_info "Patching vgg16_bn.py for torchvision compatibility..."
        python3.12 << 'EOF'
import sys

vgg_file = "venv/lib/python3.12/site-packages/craft_text_detector/models/basenet/vgg16_bn.py"

try:
    with open(vgg_file, 'r') as f:
        lines = f.readlines()
    
    # Find and replace the problematic section
    new_lines = []
    skip_next = False
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Skip old model_urls imports
        if 'from torchvision.models.vgg import model_urls' in line:
            i += 1
            continue
        if 'model_urls["vgg16_bn"]' in line:
            i += 1
            continue
            
        # Replace pretrained parameter usage
        if 'vgg_pretrained_features = models.vgg16_bn(pretrained=pretrained).features' in line:
            indent = len(line) - len(line.lstrip())
            new_lines.append(' ' * indent + 'if pretrained:\n')
            new_lines.append(' ' * (indent + 4) + 'from torchvision.models import VGG16_BN_Weights\n')
            new_lines.append(' ' * (indent + 4) + 'vgg_pretrained_features = models.vgg16_bn(weights=VGG16_BN_Weights.IMAGENET1K_V1).features\n')
            new_lines.append(' ' * indent + 'else:\n')
            new_lines.append(' ' * (indent + 4) + 'vgg_pretrained_features = models.vgg16_bn(weights=None).features\n')
            i += 1
            continue
        
        new_lines.append(line)
        i += 1
    
    # Write back
    with open(vgg_file, 'w') as f:
        f.writelines(new_lines)
    
    print("✓ Successfully patched vgg16_bn.py")
    sys.exit(0)
    
except Exception as e:
    print(f"✗ Error patching file: {e}")
    sys.exit(1)
EOF
        
        if [ $? -eq 0 ]; then
            print_success "CRAFT compatibility fix applied successfully"
        else
            print_error "Failed to apply compatibility fix"
            print_warning "Backend may fail to start. Check logs if issues occur."
        fi
    else
        print_warning "vgg16_bn.py not found - craft-text-detector may not be installed correctly"
    fi
    
    deactivate
    print_success "Backend setup complete!"
    
    cd "$SCRIPT_DIR"
    echo ""
    
    # Setup frontend
    print_step "Setting up Next.js frontend..."
    cd "$FRONTEND_DIR"
    
    if [ -d "node_modules" ]; then
        print_warning "Removing old node_modules..."
        rm -rf node_modules
    fi
    
    print_info "Installing Node.js dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        print_error "Failed to install Node.js dependencies!"
        print_info "Try running: cd $FRONTEND_DIR && npm install manually"
        cd "$SCRIPT_DIR"
        exit 1
    fi
    
    if [ ! -f ".env.local" ]; then
        print_info "Creating .env.local..."
        echo "PYTHON_API_URL=http://localhost:8005" > .env.local
    fi
    
    print_success "Frontend setup complete!"
    
    cd "$SCRIPT_DIR"
    echo ""
    
    print_success "${GREEN}Setup completed successfully!${NC}"
    echo ""
    print_info "Next steps:"
    echo -e "  ${CYAN}pobimorc start${NC}  - Start services"
    echo -e "  ${CYAN}pobimorc status${NC} - Check status"
    echo ""
}

# Start command
cmd_start() {
    print_banner
    
    # Check if already running
    if is_backend_running || is_frontend_running; then
        print_error "Services are already running!"
        print_info "Use 'pobimorc stop' first or 'pobimorc restart'"
        exit 1
    fi
    
    # Check if setup done
    if [ ! -d "$BACKEND_DIR/venv" ] || [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        print_error "System not set up yet!"
        print_info "Run 'pobimorc setup' first"
        exit 1
    fi
    
    mkdir -p "$LOGS_DIR"
    
    # Start backend
    print_step "Starting backend on port 8005..."
    cd "$BACKEND_DIR"
    source venv/bin/activate
    nohup python main.py > "$LOGS_DIR/backend.log" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
    deactivate
    print_success "Backend started (PID: $(cat $BACKEND_PID_FILE))"
    
    sleep 2
    
    # Start frontend
    print_step "Starting frontend on port 3005..."
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$LOGS_DIR/frontend.log" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    print_success "Frontend started (PID: $(cat $FRONTEND_PID_FILE))"
    local frontend_network_host
    frontend_network_host=$(get_network_host)
    print_info "Frontend network URL: http://$frontend_network_host:3005"
    
    cd "$SCRIPT_DIR"
    echo ""
    
    print_success "${GREEN}All services started!${NC}"
    echo ""
    
    # Wait for backend to be ready
    print_info "Waiting for backend to initialize..."
    local max_wait=30
    local waited=0
    local backend_ready=false
    
    while [ $waited -lt $max_wait ]; do
        if curl -s http://localhost:8005/health > /dev/null 2>&1; then
            backend_ready=true
            break
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done
    echo ""
    
    if [ "$backend_ready" = true ]; then
        print_success "Backend is ready and healthy!"
        
        # Show backend status
        local health_response=$(curl -s http://localhost:8005/health 2>/dev/null)
        if [ ! -z "$health_response" ]; then
            print_info "Backend status: $health_response"
        fi
    else
        print_warning "Backend may still be starting up (CRAFT models loading)..."
        print_info "Check logs with: pobimorc logs backend"
    fi
    
    echo ""
    print_info "Access URLs:"
    local frontend_network_host
    frontend_network_host=$(get_network_host)
    echo -e "  Frontend:  ${CYAN}http://localhost:3005${NC}"
    echo -e "  Frontend (Network): ${CYAN}http://$frontend_network_host:3005${NC}"
    echo -e "  Backend:   ${CYAN}http://localhost:8005${NC}"
    echo -e "  API Docs:  ${CYAN}http://localhost:8005/docs${NC}"
    echo ""
    print_info "View logs: ${CYAN}pobimorc logs${NC}"
    print_info "Stop: ${CYAN}pobimorc stop${NC}"
    echo ""
}

# Stop command
cmd_stop() {
    print_banner
    print_step "Stopping services..."
    echo ""
    
    local stopped=0
    
    # Stop backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        local pid=$(cat "$BACKEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            print_info "Stopping backend (PID: $pid)..."
            kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
            sleep 1
            print_success "Backend stopped"
            stopped=1
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # Stop frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            print_info "Stopping frontend (PID: $pid)..."
            kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
            sleep 1
            print_success "Frontend stopped"
            stopped=1
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # Cleanup backup
    pkill -f "python main.py" 2>/dev/null
    pkill -f "npm run dev" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    
    # Kill by port
    local backend_port_pid=$(lsof -t -i:8005 2>/dev/null || true)
    if [ ! -z "$backend_port_pid" ]; then
        kill -9 "$backend_port_pid" 2>/dev/null || true
    fi
    
    local frontend_port_pid=$(lsof -t -i:3005 2>/dev/null || true)
    if [ ! -z "$frontend_port_pid" ]; then
        kill -9 "$frontend_port_pid" 2>/dev/null || true
    fi
    
    if [ $stopped -eq 0 ]; then
        print_warning "No services were running"
    else
        echo ""
        print_success "${GREEN}All services stopped${NC}"
    fi
    echo ""
}

# Restart command
cmd_restart() {
    print_banner
    print_step "Restarting services..."
    echo ""
    cmd_stop
    sleep 2
    cmd_start
}

# Logs command
cmd_logs() {
    local service="${1:-all}"
    
    print_banner
    
    if [ ! -d "$LOGS_DIR" ]; then
        print_error "No logs found. Services haven't been started yet."
        exit 1
    fi
    
    case "$service" in
        backend|be)
            print_info "Backend logs (Ctrl+C to exit):"
            echo ""
            tail -f "$LOGS_DIR/backend.log"
            ;;
        frontend|fe)
            print_info "Frontend logs (Ctrl+C to exit):"
            echo ""
            tail -f "$LOGS_DIR/frontend.log"
            ;;
        all|*)
            print_info "Both logs (Ctrl+C to exit):"
            echo ""
            tail -f "$LOGS_DIR/backend.log" "$LOGS_DIR/frontend.log"
            ;;
    esac
}

# Test command
cmd_test() {
    print_banner
    print_step "Running system tests..."
    echo ""
    
    # Check if services are running
    if ! is_backend_running; then
        print_error "Backend is not running!"
        print_info "Start with: pobimorc start"
        exit 1
    fi
    
    if ! is_frontend_running; then
        print_error "Frontend is not running!"
        print_info "Start with: pobimorc start"
        exit 1
    fi
    
    print_success "Services are running"
    echo ""
    
    # Test backend health
    print_step "Testing backend health endpoint..."
    local health_response=$(curl -s http://localhost:8005/health 2>/dev/null)
    
    if [ -z "$health_response" ]; then
        print_error "Backend is not responding!"
        print_info "Check logs: pobimorc logs backend"
        exit 1
    fi
    
    print_success "Backend health check passed"
    echo -e "  Response: ${CYAN}$health_response${NC}"
    echo ""
    
    # Test backend API docs
    print_step "Testing API documentation..."
    local docs_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8005/docs 2>/dev/null)
    
    if [ "$docs_response" = "200" ]; then
        print_success "API docs accessible at http://localhost:8005/docs"
    else
        print_warning "API docs returned status: $docs_response"
    fi
    echo ""
    
    # Test frontend
    print_step "Testing frontend..."
    local frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005 2>/dev/null)
    
    if [ "$frontend_response" = "200" ]; then
        print_success "Frontend accessible at http://localhost:3005"
    else
        print_warning "Frontend returned status: $frontend_response"
    fi
    echo ""
    
    # Check Python version in venv
    print_step "Checking Python environment..."
    cd "$BACKEND_DIR"
    source venv/bin/activate
    local python_version=$(python --version 2>&1)
    print_success "Virtual environment: $python_version"
    
    # Check key packages
    local packages=("fastapi" "torch" "easyocr" "craft-text-detector")
    for pkg in "${packages[@]}"; do
        if pip show "$pkg" > /dev/null 2>&1; then
            local version=$(pip show "$pkg" | grep "^Version:" | cut -d' ' -f2)
            print_success "$pkg: $version"
        else
            print_error "$pkg: NOT INSTALLED"
        fi
    done
    deactivate
    cd "$SCRIPT_DIR"
    echo ""
    
    print_success "${GREEN}System tests completed!${NC}"
    echo ""
}

# Help command
cmd_help() {
    print_banner
    echo -e "${CYAN}Usage:${NC}"
    echo "  pobimorc <command> [options]"
    echo ""
    echo -e "${CYAN}Commands:${NC}"
    echo -e "  ${GREEN}setup${NC}              Install and configure the system"
    echo -e "  ${GREEN}start${NC}              Start backend and frontend services"
    echo -e "  ${GREEN}stop${NC}               Stop all services"
    echo -e "  ${GREEN}restart${NC}            Restart all services"
    echo -e "  ${GREEN}status${NC}             Show system status"
    echo -e "  ${GREEN}test${NC}               Run system health tests"
    echo -e "  ${GREEN}logs${NC} [service]     Show logs (all|backend|frontend)"
    echo -e "  ${GREEN}help${NC}               Show this help message"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  pobimorc setup        # First time setup"
    echo "  pobimorc start        # Start services"
    echo "  pobimorc status       # Check status"
    echo "  pobimorc test         # Test system health"
    echo "  pobimorc logs         # View all logs"
    echo "  pobimorc logs backend # View backend logs only"
    echo "  pobimorc stop         # Stop services"
    echo ""
    echo -e "${CYAN}Quick Start:${NC}"
    echo "  1. pobimorc setup"
    echo "  2. pobimorc start"
    echo "  3. pobimorc test      # Verify everything works"
    echo "  4. Open http://localhost:3005"
    echo ""
    echo -e "${CYAN}Troubleshooting:${NC}"
    echo "  - If backend fails: pobimorc logs backend"
    echo "  - Python 3.12 required (not 3.13+)"
    echo "  - CUDA support: nvidia-smi to check GPU"
    echo "  - Compatibility fix applied automatically during setup"
    echo ""
}

# Interactive menu
show_menu() {
    print_banner
    echo -e "${CYAN}Main Menu${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "  ${GREEN}1${NC}. Setup System          - ติดตั้งและตั้งค่าระบบครั้งแรก"
    echo -e "  ${GREEN}2${NC}. Start Services        - เริ่มทำงาน Backend + Frontend"
    echo -e "  ${GREEN}3${NC}. Stop Services         - หยุดการทำงานทั้งหมด"
    echo -e "  ${GREEN}4${NC}. Restart Services      - รีสตาร์ทระบบ"
    echo -e "  ${GREEN}5${NC}. System Status         - ตรวจสอบสถานะระบบ"
    echo -e "  ${GREEN}6${NC}. Test System           - ทดสอบระบบทั้งหมด"
    echo -e "  ${GREEN}7${NC}. View All Logs         - ดู logs ทั้งหมด"
    echo -e "  ${GREEN}8${NC}. View Backend Logs     - ดู backend logs"
    echo -e "  ${GREEN}9${NC}. View Frontend Logs    - ดู frontend logs"
    echo -e "  ${YELLOW}h${NC}. Help                  - คำแนะนำการใช้งาน"
    echo -e "  ${RED}0${NC}. Exit                  - ออกจากโปรแกรม"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Interactive mode
interactive_mode() {
    while true; do
        show_menu
        echo -ne "${CYAN}เลือกคำสั่ง [0-9/h]:${NC} "
        read -r choice
        echo ""
        
        case "$choice" in
            1)
                cmd_setup
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            2)
                cmd_start
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            3)
                cmd_stop
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            4)
                cmd_restart
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            5)
                cmd_status
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            6)
                cmd_test
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            7)
                cmd_logs "all"
                ;;
            8)
                cmd_logs "backend"
                ;;
            9)
                cmd_logs "frontend"
                ;;
            h|H)
                cmd_help
                echo ""
                echo -ne "${YELLOW}กด Enter เพื่อกลับไปเมนูหลัก...${NC}"
                read
                ;;
            0)
                print_info "ออกจากโปรแกรม..."
                echo ""
                exit 0
                ;;
            *)
                print_error "กรุณาเลือก 0-9 หรือ h เท่านั้น"
                sleep 2
                ;;
        esac
    done
}

# Main
main() {
    # If no arguments, show interactive menu
    if [ $# -eq 0 ]; then
        interactive_mode
        exit 0
    fi
    
    # Command line mode
    local command="${1}"
    shift || true
    
    case "$command" in
        setup|install)
            cmd_setup "$@"
            ;;
        start|run)
            cmd_start "$@"
            ;;
        stop|kill)
            cmd_stop "$@"
            ;;
        restart|reload)
            cmd_restart "$@"
            ;;
        status|ps)
            cmd_status "$@"
            ;;
        test|check)
            cmd_test "$@"
            ;;
        logs|log)
            cmd_logs "$@"
            ;;
        help|-h|--help)
            cmd_help
            ;;
        menu|m)
            interactive_mode
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
