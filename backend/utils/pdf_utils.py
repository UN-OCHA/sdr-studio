import tempfile
import subprocess
import os

def markdown_to_pdf_typst(md_content: str, title: str) -> bytes:
    # Simplified Typst template logic
    typst_content = f"""
    #set page(margin: 2cm, paper: "a4")
    #set text(font: "libertertine", size: 11pt)
    #set heading(numbering: "1.")
    
    #align(center)[
        #block(text(weight: "bold", size: 24pt)[{title}])
        #v(1em)
        #text(size: 14pt)[Media Sweep Report]
    ]
    
    #v(2em)
    
    {md_content}
    """
    
    with tempfile.TemporaryDirectory() as tmpdir:
        md_path = os.path.join(tmpdir, "report.md")
        pdf_path = os.path.join(tmpdir, "report.pdf")
        
        with open(md_path, "w") as f:
            f.write(md_content)
            
        try:
            # We use pandoc as a reliable bridge. 
            subprocess.run(["pandoc", md_path, "--metadata", f"title={title}", "-o", pdf_path], check=True)
            with open(pdf_path, "rb") as f:
                return f.read()
        except Exception as e:
            raise Exception(f"PDF conversion failed: {e}. Ensure pandoc is installed.")
